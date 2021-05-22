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
        address[] receivers,
        uint256[] amounts,
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
        address[] receivers,
        uint256[] amounts,
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
     * @dev Executes a transfer from one sender to one or multiple receivers.
     *
     * Requirements:
     *
     * - caller must be a network contract
     */
    function transfer(
        address token,
        address sender,
        address[] memory receivers,
        uint256[] memory amounts,
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
                receivers,
                amounts,
                feePercentage,
                paymentType,
                metadata
            );
        }

        address[] memory batchSenders = new address[](1);
        uint256[][] memory batchAmounts = new uint256[][](1);
        bytes32[] memory batchMetadata = new bytes32[](1);

        batchSenders[0] = sender;
        batchAmounts[0] = amounts;
        batchMetadata[0] = metadata;

        bool[] memory results = _erc20Transfers(
            IERC20(token),
            batchSenders,
            receivers,
            batchAmounts,
            feePercentage,
            paymentType,
            batchMetadata
        );

        return results[0];
    }

    /**
     * @dev Executes a batch transfer from multiple senders to one or multiple receivers.
     *
     * If `i` is the index of the sender and `j` the index of the receiver, each sender
     * `senders[i]` will transfer `amounts[i][j]` to `receivers[i]`.
     *
     * Requirements:
     *
     * - caller must be a network contract
     */
    function batchTransfers(
        address token,
        address[] memory senders,
        address[] memory receivers,
        uint256[][] memory amounts,
        address feeAccount,
        bytes32 paymentType,
        bytes32[] memory metadata
    )
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
        returns (bool[] memory success)
    {
        require(token != ETH_TOKEN, "Transfers: eth batch transfers are not supported");

        return _erc20Transfers(
            IERC20(token),
            senders,
            receivers,
            amounts,
            feeProvider.getFee(feeAccount, paymentType),
            paymentType,
            metadata
        );
    }

    /**
     * @dev Executes erc20 transfers from multiple senders to multiple receivers.
     */
    function _erc20Transfers(
        IERC20 token,
        address[] memory senders,
        address[] memory receivers,
        uint256[][] memory amounts,
        uint256 feePercentage,
        bytes32 paymentType,
        bytes32[] memory metadata
    )
        internal
        returns (bool[] memory success)
    {
        require(senders.length != 0, "Transfers: no senders");
        require(receivers.length != 0, "Transfers: no receivers");
        require(amounts.length == senders.length, "Transfers: parameters length mismatch");
        require(senders.length == metadata.length, "Transfers: parameters length mismatch");

        token = IERC20(tokensRegistry.getLatestAddress(address(token)));

        require(
            tokensRegistry.isActive(address(token)),
            "Transfers: inactive or unsupported token"
        );

        uint256 totalFee;
        uint256[] memory receiverAmounts = new uint256[](receivers.length);

        success = new bool[](senders.length);

        for (uint256 i = 0; i < senders.length; i++) {
            require(senders[i] != address(0), "Transfers: sender is the zero address");
            require(amounts[i].length == receivers.length, "Transfers: parameters length mismatch");

            uint256 totalAmount = Arrays.sum(amounts[i]);

            success[i] = _hasEnoughTokens(token, senders[i], totalAmount);

            if (!success[i]) {
                emit TransferFailed(
                    address(token),
                    senders[i],
                    receivers,
                    amounts[i],
                    paymentType,
                    metadata[i]
                );

                continue;
            }

            token.safeTransferFrom(senders[i], address(this), totalAmount);

            for (uint256 j = 0; j < receivers.length; j++) {
                uint256 fee = _calculateFee(amounts[i][j], feePercentage);

                receiverAmounts[j] += amounts[i][j] - fee;
                totalFee += fee;
            }

            emit TransferSuccessful(
                address(token),
                senders[i],
                receivers,
                amounts[i],
                feePercentage,
                paymentType,
                metadata[i]
            );
        }

        _transferTokens(token, receivers, receiverAmounts);

        if (totalFee != 0) {
            token.safeTransfer(feeCollector, totalFee);
        }
    }

    /**
     * @dev Executes eth transfers from one sender to multiple receivers.
     */
    function _ethTransfer(
        address sender,
        address[] memory receivers,
        uint256[] memory amounts,
        uint256 feePercentage,
        bytes32 paymentType,
        bytes32 metadata
    )
        internal
        returns (bool success)
    {
        require(receivers.length != 0, "Transfers: no receivers");
        require(amounts.length == receivers.length, "Transfers: parameters length mismatch");

        if (msg.value != Arrays.sum(amounts)) {
            payable(msg.sender).sendValue(msg.value);

            emit TransferFailed(ETH_TOKEN, sender, receivers, amounts, paymentType, metadata);

            return false;
        }

        uint256 totalFee = _calculateFee(msg.value, feePercentage);

        for (uint256 i = 0; i < receivers.length; i++) {
            uint256 netAmount = amounts[i] - _calculateFee(amounts[i], feePercentage);

            payable(receivers[i]).sendValue(netAmount);
        }

        if (totalFee != 0) {
            feeCollector.sendValue(totalFee);
        }

        emit TransferSuccessful(
            ETH_TOKEN,
            sender,
            receivers,
            amounts,
            feePercentage,
            paymentType,
            metadata
        );

        return true;
    }

    /**
     * @dev Sends tokens to one or multiple receivers.
     */
    function _transferTokens(IERC20 token, address[] memory receivers, uint256[] memory amounts)
        internal
    {
        for (uint256 i = 0; i < receivers.length; i++) {
            require(receivers[i] != address(0), "Transfers: receiver is the zero address");

            token.safeTransfer(receivers[i], amounts[i]);
        }
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
