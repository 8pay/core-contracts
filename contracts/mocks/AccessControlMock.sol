// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../access/AccessControl.sol";

/**
 * @dev Mock contract used to test AccessControl contract.
 */
contract AccessControlMock is AccessControl {
    // solhint-disable-next-line
    function callableByRole(bytes32 role) external onlyRole(role) {}
}
