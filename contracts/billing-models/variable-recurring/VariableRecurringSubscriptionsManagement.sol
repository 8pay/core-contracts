// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ITransfers } from "../../interfaces/ITransfers.sol";
import { IVariableRecurringPlansDatabase } from "../../interfaces/IVariableRecurringPlansDatabase.sol";
import { IVariableRecurringSubscriptionsDatabase } from "../../interfaces/IVariableRecurringSubscriptionsDatabase.sol";
import { Arrays } from "../../libraries/Arrays.sol";
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
        require(
            subscriptionIds.length == amounts.length,
            "VRSM: parameters length mismatch"
        );

        require(!Arrays.hasDuplicates(subscriptionIds), "VRSM: duplicate subscription ids");

        uint256[] memory expiries;
        uint256[] memory cancellations;

        (
            subscriptionIds,
            amounts,
            expiries,
            cancellations
        ) = _filterBillableSubscriptions(planId, subscriptionIds, amounts);


        require(subscriptionIds.length != 0, "VRSM: no billable subscriptions");

        uint256 period = plansDB.getPeriod(planId);
        bool[] memory success = _bill(planId, subscriptionIds, amounts);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (!success[i]) {
                emit BillingFailed(planId, subscriptionIds[i], amounts[i]);
                continue;
            }

            emit Billing(planId, subscriptionIds[i], amounts[i], expiries[i] - period + 1, expiries[i]);

            if (cancellations[i] != 0) {
                address account = subscriptionsDB.getAccount(subscriptionIds[i]);

                subscriptionsDB.setSubscriptionId(planId, account, bytes32(0));

                _deleteSubscription(subscriptionIds[i]);

                emit SubscriptionCancelled(planId, subscriptionIds[i]);
                continue;
            }

            subscriptionsDB.setCycleStart(subscriptionIds[i], expiries[i] + 1);
        }
    }

    /**
     * @dev Executes the actual token transfers for the billings.
     */
    function _bill(
        bytes32 planId,
        bytes32[] memory subscriptionIds,
        uint256[] memory amounts
    )
        internal
        returns (bool[] memory success)
    {
        address[] memory senders;
        address[] memory receivers;
        uint256[][] memory batchAmounts;

        (
            senders,
            receivers,
            batchAmounts
        ) = _prepareForTransfers(planId, subscriptionIds, amounts);

        return transfers.batchTransfers(
            plansDB.getToken(planId),
            senders,
            receivers,
            batchAmounts,
            plansDB.getAdmin(planId),
            PAYMENT_TYPE,
            subscriptionIds
        );
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

    /**
     * @dev Returns the data needed to perform billing transfers.
     */
    function _prepareForTransfers(
        bytes32 planId,
        bytes32[] memory subscriptionIds,
        uint256[] memory amounts
    )
        internal
        view
        returns (
            address[] memory senders,
            address[] memory receivers,
            uint256[][] memory batchAmounts
        )
    {
        senders = new address[](subscriptionIds.length);
        batchAmounts = new uint256[][](subscriptionIds.length);
        receivers = plansDB.getReceivers(planId);

        uint256[] memory percentages = plansDB.getPercentages(planId);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            senders[i] = subscriptionsDB.getAccount(subscriptionIds[i]);
            batchAmounts[i] = _calculateAmounts(amounts[i], percentages);
        }

        return (senders, receivers, batchAmounts);
    }

    /**
     * @dev Returns a list of billable subscriptions, filtering invalid and the ones
     * where the current cycle is not over yet.
     */
    function _filterBillableSubscriptions(
        bytes32 planId,
        bytes32[] memory subscriptionIds,
        uint256[] memory amounts
    )
        internal
        view
        returns (
            bytes32[] memory filteredSubscriptionIds,
            uint256[] memory filteredAmounts,
            uint256[] memory expiries,
            uint256[] memory cancellations
        )
    {
        filteredSubscriptionIds = new bytes32[](subscriptionIds.length);
        filteredAmounts = new uint256[](subscriptionIds.length);
        expiries = new uint256[](subscriptionIds.length);
        cancellations = new uint256[](subscriptionIds.length);

        uint256 length;
        uint256 period = plansDB.getPeriod(planId);
        uint256 maxAmount = plansDB.getMaxAmount(planId);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (
                subscriptionsDB.getPlanId(subscriptionIds[i]) == planId &&
                amounts[i] <= maxAmount
            ) {
                expiries[length] = subscriptionsDB.getCycleStart(subscriptionIds[i]) + period - 1;
                cancellations[length] = subscriptionsDB.getCancellationRequest(subscriptionIds[i]);

                if (expiries[length] < block.timestamp || cancellations[length] != 0) {
                    filteredSubscriptionIds[length] = subscriptionIds[i];
                    filteredAmounts[length] = amounts[i];
                    length++;
                }
            }
        }

        Arrays.shrink(filteredSubscriptionIds, length);
        Arrays.shrink(filteredAmounts, length);
        Arrays.shrink(expiries, length);
        Arrays.shrink(cancellations, length);

        return (filteredSubscriptionIds, filteredAmounts, expiries, cancellations);
    }

    /**
     * @dev Returns the partial amounts given a total amount and an array of percentages.
     */
    function _calculateAmounts(uint256 totalAmount, uint256[] memory percentages)
        internal
        pure
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](percentages.length);

        for (uint256 i = 0; i < percentages.length; i++) {
            amounts[i] = totalAmount * percentages[i] / 10000;
        }
    }
}
