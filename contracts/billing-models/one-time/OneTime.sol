// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ITransfers } from "../../interfaces/ITransfers.sol";

/**
 * @dev The contract to send payments to one or multiple receivers, associating
 * additional parameters such as a description and a tag.
 */
contract OneTime is Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    ITransfers public transfers;

    bytes32 public constant PAYMENT_TYPE = keccak256("ONE_TIME");
    address public constant ETH_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /**
     * @dev Emitted when payment is executed.
     */
    event Payment(
        address indexed sender,
        bytes32 indexed tag,
        address token,
        string description,
        string category
    );

    /**
     * @dev Emitted for every receiver inside a payment.
     * Allows indexing by receiver `account`.
     */
    event Receiver(address indexed account, uint256 amount);

    /**
     * @dev Initializes contracts references.
     */
    function initialize(ITransfers transfers_) external initializer {
        transfers = transfers_;
    }

    /**
     * @dev Sends a payment to one or multiple receivers.
     * Both erc20 and eth transfers are supported.
     */
    function send(
        string memory description,
        address token,
        address[] memory receivers,
        uint256[] memory amounts,
        string memory category,
        bytes32 tag
    )
        external
        payable
    {
        require(receivers.length != 0, "OneTime: no receivers");
        require(token == ETH_TOKEN || msg.value == 0, "OneTime: invalid msg value");
        require(bytes(description).length != 0, "OneTime: description is empty");

        require(
            receivers.length == amounts.length,
            "OneTime: parameters length mismatch"
        );

        for (uint i = 0; i < receivers.length; i++) {
            require(receivers[i] != address(0), "OneTime: receiver is the zero address");
            require(amounts[i] != 0, "OneTime: amount is zero");

            uint256 value = token == ETH_TOKEN ? amounts[i] : 0;

            require(
                transfers.transfer{value: value}(
                    token,
                    msg.sender,
                    receivers[i],
                    amounts[i],
                    address(0),
                    PAYMENT_TYPE,
                    bytes32(0)
                ),
                "OneTime: transfer failed"
            );
        }

        emit Payment(msg.sender, tag, token, description, category);

        for (uint256 i = 0; i < receivers.length; i++) {
            emit Receiver(receivers[i], amounts[i]);
        }
    }
}
