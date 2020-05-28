// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ITransfers } from "../../interfaces/ITransfers.sol";
import { Arrays } from "../../libraries/Arrays.sol";
import { IFixedRecurringPlansDatabase } from "../../interfaces/IFixedRecurringPlansDatabase.sol";
import { IFixedRecurringSubscriptionsDatabase } from "../../interfaces/IFixedRecurringSubscriptionsDatabase.sol";
import { FixedRecurringConstants } from "./FixedRecurringConstants.sol";

/**
 * @dev The contract allows the plan's admin or privileged accounts to
 * perform management operations on the subscriptions to fixed recurring plans.
 *
 * The operations that can be triggered are bill and terminate.
 *
 * In order to perform a billing operation, the previous paid cycle of a subscription
 * must be over. When billing is performed successfully, a {Billing} event is emitted
 * and a new cycle starts.
 * If the subscriber does not have enough funds to fulfill the payment, a {BillingFailed}
 * event is emitted and the current cycle will not be changed.
 * It is up to the vendor to perform a retry using its own policy or terminate the subscription.
 *
 * Subscriptions can be forcefully terminated anytime.
 */
contract FixedRecurringSubscriptionsManagement is FixedRecurringConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IFixedRecurringPlansDatabase public plansDB;
    IFixedRecurringSubscriptionsDatabase public subscriptionsDB;
    ITransfers public transfers;

    /**
     * @dev Emitted when a subscription is forcefully terminated.
     */
    event SubscriptionTerminated(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Emitted when a billing operation is performed successfully.
     */
    event Billing(bytes32 indexed planId, bytes32 indexed subscriptionId, uint256 cycleStart, uint256 cycleEnd);

    /**
     * @dev Emitted when a billing operation failed due to unsufficient funds.
     */
    event BillingFailed(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Modifiers that checks if the caller has `permission` on the plan.
     */
    modifier onlyPrivileged(bytes32 planId, bytes32 permission) {
        require(
            plansDB.getAdmin(planId) == msg.sender ||
            plansDB.hasPermission(planId, permission, msg.sender),
            "FRSM: caller is missing permission"
        );

        _;
    }

    /**
     * @dev Initializes contracts references.
     */
    function initialize(
        IFixedRecurringPlansDatabase plansDB_,
        IFixedRecurringSubscriptionsDatabase subscriptionsDB_,
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
                subscriptionsDB.setAccount(subscriptionIds[i], address(0));
                subscriptionsDB.setPlanId(subscriptionIds[i], bytes32(0));
                subscriptionsDB.setSubscribedAt(subscriptionIds[i], 0);
                subscriptionsDB.setCycleStart(subscriptionIds[i], 0);

                emit SubscriptionTerminated(planId, subscriptionIds[i]);
            }
        }
    }

    /**
     * @dev Performs a charge on the given subscriptions.
     *
     * Skips the ones that are invalid or where the current cycle is not over yet.
     *
     * [WARNING]
     * The access to the billing function is not restricted on purpose.
     * It allows further functionalities to be implemented and doesn't cause harm
     * since the billing rules are enforces by the plan and the smart contracts.
     */
    function bill(bytes32 planId, bytes32[] memory subscriptionIds) external {
        require(!Arrays.hasDuplicates(subscriptionIds), "FRSM: duplicate subscription ids");

        uint256[] memory expiries;

        (subscriptionIds, expiries) = _filterBillableSubscriptions(planId, subscriptionIds);

        require(subscriptionIds.length != 0, "FRSM: no billable subscriptions");

        uint256 period = plansDB.getPeriod(planId);
        bool[] memory success = _bill(planId, subscriptionIds);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (!success[i]) {
                emit BillingFailed(planId, subscriptionIds[i]);
                continue;
            }

            uint256 cycleStart = expiries[i] + 1;

            subscriptionsDB.setCycleStart(subscriptionIds[i], cycleStart);

            emit Billing(planId, subscriptionIds[i], cycleStart, cycleStart + period - 1);
        }
    }

    /**
     * @dev Executes the actual token transfers for the billings.
     */
    function _bill(bytes32 planId, bytes32[] memory subscriptionIds)
        internal
        returns (bool[] memory success)
    {
        address[] memory senders;
        address[] memory receivers;
        uint256[][] memory amounts;

        (
            senders,
            receivers,
            amounts
        ) = _prepareForTransfers(planId, subscriptionIds);

        return transfers.batchTransfers(
            plansDB.getToken(planId),
            senders,
            receivers,
            amounts,
            plansDB.getAdmin(planId),
            PAYMENT_TYPE,
            subscriptionIds
        );
    }

    /**
     * @dev Returns the data needed to perform billing transfers.
     */
    function _prepareForTransfers(
        bytes32 planId,
        bytes32[] memory subscriptionIds
    )
        internal
        view
        returns (
            address[] memory senders,
            address[] memory receivers,
            uint256[][] memory amounts
        )
    {
        senders = new address[](subscriptionIds.length);
        amounts = new uint256[][](subscriptionIds.length);

        receivers = plansDB.getReceivers(planId);

        uint256[] memory planAmounts = plansDB.getAmounts(planId);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            senders[i] = subscriptionsDB.getAccount(subscriptionIds[i]);
            amounts[i] = planAmounts;
        }

        return (senders, receivers, amounts);
    }

    /**
     * @dev Returns a list of billable subscriptions, filtering invalid and the ones
     * where the current cycle is not over yet.
     */
    function _filterBillableSubscriptions(
        bytes32 planId,
        bytes32[] memory subscriptionIds
    )
        internal
        view
        returns (
            bytes32[] memory filteredSubscriptionIds,
            uint256[] memory expiries
        )
    {
        uint256 length;
        uint256 period = plansDB.getPeriod(planId);

        filteredSubscriptionIds = new bytes32[](subscriptionIds.length);
        expiries = new uint256[](subscriptionIds.length);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            bytes32 subscriptionPlanId = subscriptionsDB.getPlanId(subscriptionIds[i]);

            if (subscriptionPlanId == planId) {
                expiries[length] = subscriptionsDB.getCycleStart(subscriptionIds[i]) + period - 1;

                if (expiries[length] < block.timestamp) {
                    filteredSubscriptionIds[length] = subscriptionIds[i];
                    length++;
                }
            }
        }

        Arrays.shrink(filteredSubscriptionIds, length);
        Arrays.shrink(expiries, length);

        return (filteredSubscriptionIds, expiries);
    }
}
