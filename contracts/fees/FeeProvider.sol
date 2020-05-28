// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { IFeeProvider } from "../interfaces/IFeeProvider.sol";
import { AccessControl } from "../access/AccessControl.sol";

/**
 * @dev The FeeProvider contract keeps track of fees that will be applied to transfers
 * that occur on the system.
 *
 * There is a base fee for each payment type that is applied by default.
 * However, a custom fee can be applied to specific accounts and payment types.
 * When there is no custom fee, the base fee is applied.
 *
 * Fees are stored as unsigned integers with the last two digits being decimals (100 = 1%, 75 = 0.75%).
 */
contract FeeProvider is IFeeProvider, AccessControl {
    mapping (bytes32 => uint256) private _baseFees;
    mapping (address => mapping(bytes32 => uint256)) private _customFees;

    event BaseFeeUpdated(bytes32 indexed paymentType, uint256 fee);
    event CustomFeeUpdated(address indexed account, bytes32 indexed paymentType, uint256 fee);

    /**
     * @dev Initializes the `baseFees` for `paymentTypes`.
     */
    constructor (bytes32[] memory paymentTypes, uint256[] memory baseFees) {
        require(
            paymentTypes.length == baseFees.length,
            "FeeProvider: parameters length mismatch"
        );

        for(uint256 i = 0; i < paymentTypes.length; i++) {
            _baseFees[paymentTypes[i]] = baseFees[i];
        }
    }

    /**
     * @dev Updates the base `fee` for the `paymentType`.
     *
     * Requirements:
     *
     * - caller must have owner role
     */
    function setBaseFee(bytes32 paymentType, uint256 fee)
        external
        onlyRole(OWNER_ROLE)
    {
        _baseFees[paymentType] = fee;

        emit BaseFeeUpdated(paymentType, fee);
    }

    /**
     * @dev Sets a custom `fee` on `paymenType` for `account`.
     *
     * Requirements:
     *
     * - caller must have owner role
     */
    function setCustomFee(address account, bytes32 paymentType, uint256 fee)
        external
        onlyRole(OWNER_ROLE)
    {
        _customFees[account][paymentType] = fee;

        emit CustomFeeUpdated(account, paymentType, fee);
    }

    /**
     * @dev Returns the base fee for the `paymentType`.
     */
    function getBaseFee(bytes32 paymentType) external view returns (uint256) {
        return _baseFees[paymentType];
    }

    /**
     * @dev Returns the custom fee applied to `account` for the `paymentType`.
     */
    function getCustomFee(address account, bytes32 paymentType)
        external
        view
        returns (uint256)
    {
        return _customFees[account][paymentType];
    }

    /**
     * @dev Returns the fee to apply `account` on `paymentType`.
     */
    function getFee(address account, bytes32 paymentType)
        external
        view
        override
        returns (uint256)
    {
        uint256 customFee = _customFees[account][paymentType];

        return customFee != 0 ? customFee : _baseFees[paymentType];
    }
}
