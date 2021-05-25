// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IOnDemandPlansDatabase {
    function setAdmin(bytes32 planId, address admin) external;
    function setMinAllowance(bytes32 planId, uint256 minAllowance) external;
    function setPeriod(bytes32 planId, uint256 period) external;
    function setToken(bytes32 planId, address token) external;
    function setReceiver(bytes32 planId, address receiver) external;

    function setPermission(
        bytes32 planId,
        bytes32 permission,
        address account,
        bool value
    ) external;

    function getAdmin(bytes32 planId) external view returns (address);
    function getMinAllowance(bytes32 planId) external view returns (uint256);
    function getPeriod(bytes32 planId) external view returns (uint256);
    function getToken(bytes32 planId) external view returns (address);

    function getReceiver(bytes32 planId)
        external
        view
        returns (address);

    function hasPermission(bytes32 planId, bytes32 permission, address account)
        external
        view
        returns (bool);
}
