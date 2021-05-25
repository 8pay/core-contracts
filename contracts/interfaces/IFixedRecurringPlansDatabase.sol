// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IFixedRecurringPlansDatabase {
    function setAdmin(bytes32 planId, address admin) external;
    function setPeriod(bytes32 planId, uint256 period) external;
    function setToken(bytes32 planId, address token) external;
    function setReceiver(bytes32 planId, address receiver) external;
    function setAmount(bytes32 planId, uint256 amount) external;

    function setPermission(
        bytes32 planId,
        bytes32 permission,
        address account,
        bool value
    ) external;

    function getAdmin(bytes32 planId) external view returns (address);
    function getPeriod(bytes32 planId) external view returns (uint256);
    function getToken(bytes32 planId) external view returns (address);
    function getReceiver(bytes32 planId) external view returns (address);
    function getAmount(bytes32 planId) external view returns (uint256);

    function hasPermission(bytes32 planId, bytes32 permission, address account)
        external
        view
        returns (bool);
}
