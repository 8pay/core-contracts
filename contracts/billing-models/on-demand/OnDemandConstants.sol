// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/**
 * @dev The contract contains a set of constants that are shared between
 * multiple logic contracts of the on demand billing model.
 * Contract who intend to use these constants must inherit from this contract.
 */
contract OnDemandConstants {
    bytes32 public constant PAYMENT_TYPE = keccak256("ON_DEMAND");
    bytes32 public constant PERMISSION_BILL = keccak256("PERMISSION_BILL");
    bytes32 public constant PERMISSION_TERMINATE = keccak256("PERMISSION_TERMINATE");
}
