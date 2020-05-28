// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IVariableRecurringSubscriptionsDatabase {
    function setSubscriptionId(
        bytes32 planId,
        address account,
        bytes32 subscriptionId
    ) external;

    function setAccount(bytes32 subscriptionId, address account) external;
    function setPlanId(bytes32 subscriptionId, bytes32 planId) external;
    function setSubscribedAt(bytes32 subscriptionId, uint256 subscribedAt) external;
    function setCycleStart(bytes32 subscriptionId, uint256 cycleStart) external;
    function setCancellationRequest(bytes32 subscriptionId, uint256 cancellationRequest) external;

    function getSubscriptionId(bytes32 planId, address account)
        external
        view
        returns (bytes32);

    function getAccount(bytes32 subscriptionId)
        external
        view
        returns (address);

    function getPlanId(bytes32 subscriptionId)
        external
        view
        returns (bytes32);

    function getSubscribedAt(bytes32 subscriptionId)
        external
        view
        returns (uint256);

    function getCycleStart(bytes32 subscriptionId)
        external
        view
        returns (uint256);

    function getCancellationRequest(bytes32 subscriptionId)
        external
        view
        returns (uint256);
}
