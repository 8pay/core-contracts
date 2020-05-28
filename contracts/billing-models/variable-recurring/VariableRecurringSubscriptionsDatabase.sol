// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { AccessControl } from "../../access/AccessControl.sol";
import { Database } from "../../storage/Database.sol";
import { IVariableRecurringSubscriptionsDatabase } from "../../interfaces/IVariableRecurringSubscriptionsDatabase.sol";

/**
 * @dev This contract stores all data related to subscriptions of the variable recurring billing model.
 */
contract VariableRecurringSubscriptionsDatabase is IVariableRecurringSubscriptionsDatabase, Database, AccessControl {
    /**
     * @dev Sets the `subscriptionId` of `account` to the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setSubscriptionId(bytes32 planId, address account, bytes32 subscriptionId)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setBytes32(_getActiveSubscriptionFieldKey(planId, account), subscriptionId);
    }

    /**
     * @dev Sets the `account` of the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setAccount(bytes32 subscriptionId, address account)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setAddress(_getSubscriptionFieldKey(subscriptionId, "account"), account);
    }

    /**
     * @dev Sets the `planId` of the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setPlanId(bytes32 subscriptionId, bytes32 planId)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setBytes32(_getSubscriptionFieldKey(subscriptionId, "planId"), planId);
    }

    /**
     * @dev Sets the `timestamp` of subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setSubscribedAt(bytes32 subscriptionId, uint256 subscribedAt)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getSubscriptionFieldKey(subscriptionId, "subscribedAt"), subscribedAt);
    }

    /**
     * @dev Sets the `cycleStart` of the current cycle of the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setCycleStart(bytes32 subscriptionId, uint256 cycleStart)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getSubscriptionFieldKey(subscriptionId, "cycleStart"), cycleStart);
    }

    /**
     * @dev Sets the `cancellationRequest` timestamp of the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setCancellationRequest(bytes32 subscriptionId, uint256 cancellationRequest)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getSubscriptionFieldKey(subscriptionId, "cancellationRequest"), cancellationRequest);
    }

    /**
     * @dev Returns the id of the subscription.
     */
    function getSubscriptionId(bytes32 planId, address account)
        external
        view
        override
        returns (bytes32)
    {
        return _getBytes32(_getActiveSubscriptionFieldKey(planId, account));
    }

    /**
     * @dev Returns the account of the subscription.
     */
    function getAccount(bytes32 subscriptionId)
        external
        view
        override
        returns (address)
    {
        return _getAddress(_getSubscriptionFieldKey(subscriptionId, "account"));
    }

    /**
     * @dev Returns the id of plan for the subscription.
     */
    function getPlanId(bytes32 subscriptionId)
        external
        view
        override
        returns (bytes32)
    {
        return _getBytes32(_getSubscriptionFieldKey(subscriptionId, "planId"));
    }

    /**
     * @dev Returns the timestamp of subscription.
     */
    function getSubscribedAt(bytes32 subscriptionId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getSubscriptionFieldKey(subscriptionId, "subscribedAt"));
    }

    /**
     * @dev Returns the start of the current cycle.
     */
    function getCycleStart(bytes32 subscriptionId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getSubscriptionFieldKey(subscriptionId, "cycleStart"));
    }

    /**
     * @dev Returns the timestamp of the cancellation request.
     */
    function getCancellationRequest(bytes32 subscriptionId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getSubscriptionFieldKey(subscriptionId, "cancellationRequest"));
    }

    /**
     * @dev Returns an hash to be used as key for storing a subscription's field.
     */
    function _getSubscriptionFieldKey(bytes32 subscriptionId, string memory field)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(subscriptionId, field));
    }

    /**
     * @dev Returns an hash to be used as key for storing the active subscription
     * of an account to a plan.
     */
    function _getActiveSubscriptionFieldKey(bytes32 planId, address account)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("active", planId, account));
    }
}
