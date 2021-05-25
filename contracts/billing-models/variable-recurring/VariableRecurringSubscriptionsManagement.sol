// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ITransfers } from "../../interfaces/ITransfers.sol";
import { IVariableRecurringPlansDatabase } from "../../interfaces/IVariableRecurringPlansDatabase.sol";
import { IVariableRecurringSubscriptionsDatabase } from "../../interfaces/IVariableRecurringSubscriptionsDatabase.sol";
import { VariableRecurringConstants } from "./VariableRecurringConstants.sol";

/**
 * @dev The contract allows the plan's admin or privileged accounts to
 * perform management operations on the subscriptions to variable recurring plans.
 *
 * The operations that can be triggered are bill and terminate.
 *
 * In order to perform a billing operation, the previous cycle of a subscription
 * must be over. When billing is performed successfully, a {Billing} event is emitted
 * and a new cycle starts.
 * If the subscriber does not have enough funds to fulfill the payment, a {BillingFailed}
 * event is emitted and the current cycle will not be changed.
 * It is up to the vendor to perform a retry using its own policy or terminate the subscription.
 *
 * If a cancellation has been requested by the customer, the subscription will be autotically
 * cancelled at the subsequent billing.
 *
 * Subscriptions can be forcefully terminated anytime.
 */
contract VariableRecurringSubscriptionsManagement is VariableRecurringConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IVariableRecurringPlansDatabase public plansDB;
    IVariableRecurringSubscriptionsDatabase public subscriptionsDB;
    ITransfers public transfers;

    /**
     * @dev Emitted when a subscription is cancelled.
     */
    event SubscriptionCancelled(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Emitted when a subscription is forcefully terminated.
     */
    event SubscriptionTerminated(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Emitted when a billing operation is performed successfully.
     */
    event Billing(bytes32 indexed planId, bytes32 indexed subscriptionId, uint256 amount, uint256 cycleStart, uint256 cycleEnd);

    /**
     * @dev Emitted when a billing operation failed due to unsufficient funds.
     */
    event BillingFailed(bytes32 indexed planId, bytes32 indexed subscriptionId, uint256 amount);

    /**
     * @dev Modifiers that checks if the caller has `permission` on the plan.
     */
    modifier onlyPrivileged(bytes32 planId, bytes32 permission) {
        require(
            plansDB.getAdmin(planId) == msg.sender ||
            plansDB.hasPermission(planId, permission, msg.sender),
            "VRSM: caller is missing permission"
        );

        _;
    }

    /**
     * @dev Initializes contracts references.
     */
    function initialize(
        IVariableRecurringPlansDatabase plansDB_,
        IVariableRecurringSubscriptionsDatabase subscriptionsDB_,
        ITransfers transfers_
    )
        external
        initializer
    {
        plansDB = plansDB_;
        subscriptionsDB = subscriptionsDB_;
        transfers = transfers_;
    }

    /**
     * @dev Terminates (forcefully cancel) a subscription immediately.
     *
     * Requirements
     *
     * - caller must be the plan's admin or an account with 'TERMINATE' permission.
     */
    function terminate(bytes32 planId, bytes32[] memory subscriptionIds)
        external
        onlyPrivileged(planId, PERMISSION_TERMINATE)
    {
        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (subscriptionsDB.getPlanId(subscriptionIds[i]) == planId) {
                address account = subscriptionsDB.getAccount(subscriptionIds[i]);

                subscriptionsDB.setSubscriptionId(planId, account, bytes32(0));

                _deleteSubscription(subscriptionIds[i]);

                emit SubscriptionTerminated(planId, subscriptionIds[i]);
            }
        }
    }

    /**
     * @dev Performs a charge on the given subscriptions.
     *
     * The provided amounts must not exceed the plan's max amount.
     * Subscriptions that are invalid or where the current cycle is not over yet.
     *
     * Requirements
     *
     * - caller must be the plan's admin or an account with 'BILL' permission
     */
    function bill(bytes32 planId, bytes32[] memory subscriptionIds, uint256[] memory amounts)
        external
        onlyPrivileged(planId, PERMISSION_BILL)
    {
        require(subscriptionIds.length == amounts.length, "VRSM: parameters length mismatch");

        address admin = plansDB.getAdmin(planId);
        address token = plansDB.getToken(planId);
        address receiver = plansDB.getReceiver(planId);
        uint256 period = plansDB.getPeriod(planId);
        uint256 maxAmount = plansDB.getMaxAmount(planId);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (subscriptionsDB.getPlanId(subscriptionIds[i]) != planId || amounts[i] > maxAmount) {
                continue;
            }

            uint256 cycleStart = subscriptionsDB.getCycleStart(subscriptionIds[i]);
            uint256 cancellationRequest = subscriptionsDB.getCancellationRequest(subscriptionIds[i]);

            if (cycleStart + period - 1 < block.timestamp || cancellationRequest != 0) {
                if (!_bill(subscriptionIds[i], token, receiver, amounts[i], admin)) {
                    emit BillingFailed(planId, subscriptionIds[i], amounts[i]);
                    continue;
                }

                emit Billing(planId, subscriptionIds[i], amounts[i], cycleStart, cycleStart + period - 1);

                if (cancellationRequest != 0) {
                    _finalizeSubscriptionCancellation(planId, subscriptionIds[i]);
                    continue;
                }

                subscriptionsDB.setCycleStart(subscriptionIds[i], cycleStart + period);
            }
        }
    }

    /**
     * @dev Executes the actual token transfer for the billing.
     */
    function _bill(bytes32 subscriptionId, address token, address receiver, uint256 amount, address admin)
        internal
        returns (bool)
    {
        return transfers.transfer(
            token,
            subscriptionsDB.getAccount(subscriptionId),
            receiver,
            amount,
            admin,
            PAYMENT_TYPE,
            subscriptionId
        );
    }

    /**
     * @dev Finalizes a cancellation request by deleting the subscription.
     */
    function _finalizeSubscriptionCancellation(bytes32 planId, bytes32 subscriptionId) internal {
        address account = subscriptionsDB.getAccount(subscriptionId);

        subscriptionsDB.setSubscriptionId(planId, account, bytes32(0));

        _deleteSubscription(subscriptionId);

        emit SubscriptionCancelled(planId, subscriptionId);
    }

     /**
     * @dev Deletes a subscription from the storage.
     */
    function _deleteSubscription(bytes32 subscriptionId) internal {
        subscriptionsDB.setAccount(subscriptionId, address(0));
        subscriptionsDB.setPlanId(subscriptionId, bytes32(0));
        subscriptionsDB.setSubscribedAt(subscriptionId, 0);
        subscriptionsDB.setCycleStart(subscriptionId, 0);
        subscriptionsDB.setCancellationRequest(subscriptionId, 0);
    }
}
