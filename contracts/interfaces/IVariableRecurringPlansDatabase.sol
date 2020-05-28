// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IVariableRecurringPlansDatabase {
    function setAdmin(bytes32 planId, address admin) external;
    function setMaxAmount(bytes32 planId, uint256 maxAmount) external;
    function setPeriod(bytes32 planId, uint256 period) external;
    function setToken(bytes32 planId, address token) external;
    function setReceivers(bytes32 planId, address[] memory receivers) external;
    function setPercentages(bytes32 planId, uint256[] memory percentages) external;

    function setPermission(
        bytes32 planId,
        bytes32 permission,
        address account,
        bool value
    ) external;

    function getAdmin(bytes32 planId)
        external
        view
        returns (address);

    function getMaxAmount(bytes32 planId)
        external
        view
        returns (uint256);

    function getPeriod(bytes32 planId)
        external
        view
        returns (uint256);

    function getToken(bytes32 planId)
        external
        view
        returns (address);

    function getReceivers(bytes32 planId)
        external
        view
        returns (address[] memory);

    function getPercentages(bytes32 planId)
        external
        view
        returns (uint256[] memory);

    function hasPermission(bytes32 planId, bytes32 permission, address account)
        external
        view
        returns (bool);
}
