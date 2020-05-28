// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ITransfers } from "../../interfaces/ITransfers.sol";
import { Arrays } from "../../libraries/Arrays.sol";
import { IOnDemandPlansDatabase } from "../../interfaces/IOnDemandPlansDatabase.sol";
import { IOnDemandSubscriptionsDatabase } from "../../interfaces/IOnDemandSubscriptionsDatabase.sol";
import { OnDemandConstants } from "./OnDemandConstants.sol";

/**
 * @dev The contract allows the plan's admin or privileged accounts to
 * perform management operations on the subscriptions to on demand plans.
 *
 * The operations that can be triggered are bill and terminate.
 *
 * In order to perform a billing operation, the total amount billed on the current cycle
 * must not exceed the allowance given by the customer.
 * When billing is performed successfully, a {Billing} event is emitted.
 * If the subscriber does not have enough funds to fulfill the payment, a {BillingFailed}
 * event is emitted.
 * It is up to the vendor to perform a retry using its own policy or terminate the subscription.
 *
 * Subscriptions can be forcefully terminated anytime.
 */
contract OnDemandSubscriptionsManagement is OnDemandConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IOnDemandPlansDatabase public plansDB;
    IOnDemandSubscriptionsDatabase public subscriptionsDB;
    ITransfers public transfers;

    /**
     * @dev Emitted when a subscription is forcefully terminated.
     */
    event SubscriptionTerminated(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Emitted when a billing operation is performed successfully.
     */
    event Billing(bytes32 indexed planId, bytes32 indexed subscriptionId, uint256 amount);

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
            "ODSM: caller is missing permission"
        );

        _;
    }

    /**
     * @dev Initializes contracts references.
     */
    function initialize(
        IOnDemandPlansDatabase plansDB_,
        IOnDemandSubscriptionsDatabase subscriptionsDB_,
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
                subscriptionsDB.setAllowance(subscriptionIds[i], 0);
                subscriptionsDB.setSpent(subscriptionIds[i], 0);
                subscriptionsDB.setLatestBilling(subscriptionIds[i], 0);

                emit SubscriptionTerminated(planId, subscriptionIds[i]);
            }
        }
    }

    /**
     * @dev Performs a charge on the given subscriptions.
     *
     * Skips the ones that are invalid or where the billing cannot be performed
     * due to exceeding the allowance of the subscription.
     *
     * Requirements
     *
     * - caller must be the plan's admin or an account with 'BILL' permission.
     */
    function bill(bytes32 planId, bytes32[] memory subscriptionIds, uint256[] memory amounts)
        external
        onlyPrivileged(planId, PERMISSION_BILL)
    {
        require(
            subscriptionIds.length == amounts.length,
            "ODSM: parameters length mismatch"
        );

        require(!Arrays.hasDuplicates(subscriptionIds), "ODSM: duplicate subscription ids");

        bool[] memory isSameCycle;

        (
            subscriptionIds,
            amounts,
            isSameCycle
        ) = _filterBillableSubscriptions(planId, subscriptionIds, amounts);

        require(subscriptionIds.length != 0, "ODSM: no billable subscriptions");

        bool[] memory success = _bill(planId, subscriptionIds, amounts);

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (!success[i]) {
                emit BillingFailed(planId, subscriptionIds[i], amounts[i]);
                continue;
            }

            uint256 spent = isSameCycle[i] ?
                subscriptionsDB.getSpent(subscriptionIds[i]) + amounts[i] : amounts[i];

            subscriptionsDB.setSpent(subscriptionIds[i], spent);
            subscriptionsDB.setLatestBilling(subscriptionIds[i], block.timestamp);

            emit Billing(planId, subscriptionIds[i], amounts[i]);
        }
    }

    /**
     * @dev Returns true if a billing of the given amount can be performed on the subscription
     * in the currency cycle.
     */
    function isBillingAllowed(bytes32 subscriptionId, uint256 amount)
        external
        view
        returns (bool)
    {
        return _isBillingAllowed(
            subscriptionId,
            amount,
            _isSameCycleOfLatestBilling(subscriptionId)
        );
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
        uint256[][] memory amounts_;

        (
            senders,
            receivers,
            amounts_
        ) = _prepareForTransfers(planId, subscriptionIds, amounts);

        return transfers.batchTransfers(
            plansDB.getToken(planId),
            senders,
            receivers,
            amounts_,
            plansDB.getAdmin(planId),
            PAYMENT_TYPE,
            subscriptionIds
        );
    }

    /**
     * @dev Internal function used to optimize gas cost of billings. Returns true if a billing of the
     * given amount can be performed on the subscription in the currency cycle.
     */
    function _isBillingAllowed(
        bytes32 subscriptionId,
        uint256 amount,
        bool isSameCycle
    )
        internal
        view
        returns (bool)
    {
        uint256 allowance = subscriptionsDB.getAllowance(subscriptionId);

        if (amount > allowance) {
            return false;
        }

        uint256 spent = subscriptionsDB.getSpent(subscriptionId);

        return !isSameCycle || spent + amount <= allowance;
    }

    /**
     * @dev Returns true if the subscription is in the same cycle
     * of the latest billing.
     */
    function _isSameCycleOfLatestBilling(bytes32 subscriptionId)
        internal
        view
        returns (bool)
    {
        uint256 subscribedAt = subscriptionsDB.getSubscribedAt(subscriptionId);
        uint256 latestBilling = subscriptionsDB.getLatestBilling(subscriptionId);
        uint256 elapsedTimeUntilNow = block.timestamp - subscribedAt;

        if (latestBilling == 0) {
            return false;
        }

        uint256 elapsedTimeUntilLatestBilling = latestBilling - subscribedAt;
        bytes32 planId = subscriptionsDB.getPlanId(subscriptionId);
        uint256 period = plansDB.getPeriod(planId);

        return elapsedTimeUntilNow / period == elapsedTimeUntilLatestBilling / period;
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
     * where the amount exceed the allowance.
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
            bool[] memory isSameCycle
        )
    {
        filteredSubscriptionIds = new bytes32[](subscriptionIds.length);
        filteredAmounts = new uint256[](subscriptionIds.length);
        isSameCycle = new bool[](subscriptionIds.length);

        uint256 length;

        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (amounts[i] != 0 && subscriptionsDB.getPlanId(subscriptionIds[i]) == planId) {
                isSameCycle[length] = _isSameCycleOfLatestBilling(subscriptionIds[i]);

                if (_isBillingAllowed(subscriptionIds[i], amounts[i], isSameCycle[length])) {
                    filteredSubscriptionIds[length] = subscriptionIds[i];
                    filteredAmounts[length] = amounts[i];
                    length++;
                }
            }
        }

        Arrays.shrink(filteredSubscriptionIds, length);
        Arrays.shrink(filteredAmounts, length);
        Arrays.shrink(isSameCycle, length);

        return (filteredSubscriptionIds, filteredAmounts, isSameCycle);
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
