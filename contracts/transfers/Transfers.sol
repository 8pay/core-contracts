// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { AccessControl } from "../access/AccessControl.sol";
import { Arrays } from "../libraries/Arrays.sol";
import { ITransfers } from "../interfaces/ITransfers.sol";
import { ITokensRegistry } from "../interfaces/ITokensRegistry.sol";
import { IFeeProvider } from "../interfaces/IFeeProvider.sol";

/**
 * @dev This contract handles all the transfers between parties that are regulated
 * by the different billing models. In order to use a token to pay for, users must
 * first approve this contract.
 *
 * The contract doesn't hold any funds at all. It pulls them from the user's wallet
 * when a payment is about to be executed and immediately sends them to the
 * receiving party.
 *
 * A small fee is retained by the protocol from the receiving party and sent to
 * the fee collector address.
 */
contract Transfers is ITransfers, Initializable, AccessControl {
    using Address for address payable;
    using SafeERC20 for IERC20;

    /// @dev Reserved memory slots
    uint256[50] private __gap;

    address payable public feeCollector;
    ITokensRegistry public tokensRegistry;
    IFeeProvider public feeProvider;

    address public constant ETH_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /**
     * @dev Emitted when a transfer is executed successfully.
     */
    event TransferSuccessful(
        address token,
        address sender,
        address receiver,
        uint256 amount,
        uint256 feePercentage,
        bytes32 paymentType,
        bytes32 metadata
    );

    /**
     * @dev Emitted when a transfer fails to executed due to insufficient funds or allowance.
     */
    event TransferFailed(
        address token,
        address sender,
        address receiver,
        uint256 amount,
        bytes32 paymentType,
        bytes32 metadata
    );

    /**
     * @dev Initializes contracts addresses.
     */
    function initialize(
        ITokensRegistry tokensRegistry_,
        IFeeProvider feeProvider_,
        address payable feeCollector_
    )
        external
        initializer
    {
        tokensRegistry = tokensRegistry_;
        feeProvider = feeProvider_;
        feeCollector = feeCollector_;
    }

    /**
     * @dev Updates the address who receives the fees.
     *
     * Requirements:
     *
     * - caller must have owner role
     */
    function setFeeCollector(address payable feeCollector_)
        external
        onlyRole(OWNER_ROLE)
    {
        feeCollector = feeCollector_;
    }

    /**
     * @dev Updates the address of the TokenRegistry contract.
     *
     * Requirements:
     *
     * - caller must have owner role
     */
    function setTokensRegistry(ITokensRegistry tokensRegistry_)
        external
        onlyRole(OWNER_ROLE)
    {
        tokensRegistry = tokensRegistry_;
    }

     /**
     * @dev Updates the address of the FeeProvider contract.
     *
     * Requirements:
     *
     * - caller must have owner role
     */
    function setFeeProvider(IFeeProvider feeProvider_)
        external
        onlyRole(OWNER_ROLE)
    {
        feeProvider = feeProvider_;
    }

    /**
     * @dev Executes a transfer from sender to receiver.
     *
     * Requirements:
     *
     * - caller must be a network contract
     */
    function transfer(
        address token,
        address sender,
        address receiver,
        uint256 amount,
        address feeAccount,
        bytes32 paymentType,
        bytes32 metadata
    )
        external
        payable
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
        returns (bool success)
    {
        uint256 feePercentage = feeProvider.getFee(feeAccount, paymentType);

        if (token == ETH_TOKEN) {
            return _ethTransfer(
                sender,
                receiver,
                amount,
                feePercentage,
                paymentType,
                metadata
            );
        }

        return _erc20Transfer(
            IERC20(token),
            sender,
            receiver,
            amount,
            feePercentage,
            paymentType,
            metadata
        );
    }

    /**
     * @dev Executes an erc20 transfer.
     */
    function _erc20Transfer(
        IERC20 token,
        address sender,
        address receiver,
        uint256 amount,
        uint256 feePercentage,
        bytes32 paymentType,
        bytes32 metadata
    )
        internal
        returns (bool success)
    {
        require(sender != address(0), "Transfers: sender is the zero address");
        require(receiver != address(0), "Transfers: receiver is the zero address");

        IERC20 latestToken = IERC20(tokensRegistry.getLatestAddress(address(token)));

        require(
            tokensRegistry.isActive(address(latestToken)),
            "Transfers: inactive or unsupported token"
        );

        if (!_hasEnoughTokens(latestToken, sender, amount)) {
            emit TransferFailed(
                address(latestToken),
                sender,
                receiver,
                amount,
                paymentType,
                metadata
            );

            return false;
        }

        uint256 netAmount = amount;

        if (feePercentage != 0) {
            uint256 fee = _calculateFee(amount, feePercentage);
            latestToken.safeTransferFrom(sender, feeCollector, fee);
            netAmount = amount - fee;
        }

        latestToken.safeTransferFrom(sender, receiver, netAmount);

        emit TransferSuccessful(
            address(latestToken),
            sender,
            receiver,
            amount,
            feePercentage,
            paymentType,
            metadata
        );

        return true;
    }

    /**
     * @dev Executes an eth transfer.
     */
    function _ethTransfer(
        address sender,
        address receiver,
        uint256 amount,
        uint256 feePercentage,
        bytes32 paymentType,
        bytes32 metadata
    )
        internal
        returns (bool success)
    {
        require(receiver != address(0), "Transfers: receiver is the zero address");

        if (msg.value != amount) {
            payable(msg.sender).sendValue(msg.value);

            emit TransferFailed(ETH_TOKEN, sender, receiver, amount, paymentType, metadata);

            return false;
        }

        uint256 netAmount = amount;

        if (feePercentage != 0) {
            uint256 fee = _calculateFee(amount, feePercentage);
            feeCollector.sendValue(fee);
            netAmount = amount - fee;
        }

        payable(receiver).sendValue(netAmount);

        emit TransferSuccessful(
            ETH_TOKEN,
            sender,
            receiver,
            amount,
            feePercentage,
            paymentType,
            metadata
        );

        return true;
    }

    /**
     * @dev Returns true if `account` has at least `amount` of `token`.
     */
    function _hasEnoughTokens(IERC20 token, address account, uint256 amount)
        internal
        view
        returns (bool)
    {
        uint256 balance = token.balanceOf(account);
        uint256 allowance = token.allowance(account, address(this));
        uint256 availableTokens = balance <= allowance ? balance : allowance;

        return availableTokens >= amount;
    }

    /**
     * @dev Returns the fee on the `amount` given the `feePercentage`.
     */
    function _calculateFee(uint256 amount, uint256 feePercentage)
        internal
        pure
        returns (uint256)
    {
        return feePercentage != 0 ? amount * feePercentage / 10000 : 0;
    }
}
