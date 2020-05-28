// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { AccessControl } from "../../access/AccessControl.sol";
import { Database } from "../../storage/Database.sol";
import { IOnDemandSubscriptionsDatabase } from "../../interfaces/IOnDemandSubscriptionsDatabase.sol";

/**
 * @dev This contract stores all data related to subscriptions of the on demand billing model.
 */
contract OnDemandSubscriptionsDatabase is IOnDemandSubscriptionsDatabase, Database, AccessControl {
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
     * @dev Sets the `allowance` given to the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setAllowance(bytes32 subscriptionId, uint256 allowance)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getSubscriptionFieldKey(subscriptionId, "allowance"), allowance);
    }

    /**
     * @dev Sets the total amount `spent` in the current cycle for the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setSpent(bytes32 subscriptionId, uint256 spent)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getSubscriptionFieldKey(subscriptionId, "spent"), spent);
    }

    /**
     * @dev Sets the timestamp of `latestBilling` of the subscription.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setLatestBilling(bytes32 subscriptionId, uint256 latestBilling)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getSubscriptionFieldKey(subscriptionId, "latestBilling"), latestBilling);
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
     * @dev Returns the id of plan of the subscription.
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
     * @dev Returns the allowance given to the subscription.
     */
    function getAllowance(bytes32 subscriptionId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getSubscriptionFieldKey(subscriptionId, "allowance"));
    }

    /**
     * @dev Returns the total amount spent in the current cycle for the subscription.
     */
    function getSpent(bytes32 subscriptionId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getSubscriptionFieldKey(subscriptionId, "spent"));
    }

    /**
     * @dev Returns the timestamp of the latest billing.
     */
    function getLatestBilling(bytes32 subscriptionId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getSubscriptionFieldKey(subscriptionId, "latestBilling"));
    }

    /**
     * @dev Returns an hash to be used as key for storing a subscription's field.
     */
    function _getSubscriptionFieldKey(bytes32 subscriptionId, string memory _field)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(subscriptionId, _field));
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
