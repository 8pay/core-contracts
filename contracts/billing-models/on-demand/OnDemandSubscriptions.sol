// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IOnDemandPlansDatabase } from "../../interfaces/IOnDemandPlansDatabase.sol";
import { IOnDemandSubscriptionsDatabase } from "../../interfaces/IOnDemandSubscriptionsDatabase.sol";
import { OnDemandConstants } from "./OnDemandConstants.sol";

/**
 * @dev This contract allows customers to adhere to on demand plans
 * thus creating a subscription. Subscriptions allow the vendor to
 * charge customers on a per-usage basis.
 *
 * Upon subscription, the customer will need to choose an allowance which is
 * the maximum amount that he can be billed over a single cycle.
 * This allowance can be updated later according to his usage.
 *
 * Subscriptions can be cancelled anytime and no more billings can be performed
 * after cancellation.
 */
contract OnDemandSubscriptions is OnDemandConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IOnDemandPlansDatabase public plansDB;
    IOnDemandSubscriptionsDatabase public subscriptionsDB;

    /**
     * @dev Emitted when `account` subscribes to the plan.
     */
    event Subscription(bytes32 indexed planId, bytes32 indexed subscriptionId, address indexed account);

    /**
     * @dev Emitted when a subscription is cancelled.
     */
    event SubscriptionCancelled(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Emitted when the allowance for a subscription is changed.
     */
    event AllowanceUpdated(bytes32 indexed planId, bytes32 indexed subscriptionId, uint256 allowance);

    /**
     * @dev Modifier that check if the caller is the subscriber.
     */
    modifier onlySubscriber(bytes32 subscriptionId) {
        require(
            subscriptionsDB.getAccount(subscriptionId) == msg.sender,
            "ODS: caller is not the subscriber"
        );

        _;
    }

    /**
     * @dev Initializes contracts references.
     */
    function initialize(
        IOnDemandPlansDatabase plansDB_,
        IOnDemandSubscriptionsDatabase subscriptionsDB_
    )
        external
        initializer
    {
        plansDB = plansDB_;
        subscriptionsDB = subscriptionsDB_;
    }

    /**
     * @dev Subscribes the caller to the given plan.
     *
     * Requirements:
     *
     * - the caller must not be already subscribed to the same plan.
     */
    function subscribe(bytes32 planId, uint256 allowance) external {
        require(plansDB.getAdmin(planId) != address(0), "ODS: invalid plan id");
        require(!isSubscribed(planId, msg.sender), "ODS: user is already subscribed");
        require(plansDB.getMinAllowance(planId) <= allowance, "ODS: insufficient allowance");

        bytes32 subscriptionId = keccak256(abi.encodePacked(planId, msg.sender, block.timestamp));

        subscriptionsDB.setSubscriptionId(planId, msg.sender, subscriptionId);
        subscriptionsDB.setAccount(subscriptionId, msg.sender);
        subscriptionsDB.setPlanId(subscriptionId, planId);
        subscriptionsDB.setSubscribedAt(subscriptionId, block.timestamp);
        subscriptionsDB.setAllowance(subscriptionId, allowance);

        emit Subscription(planId, subscriptionId, msg.sender);
        emit AllowanceUpdated(planId, subscriptionId, allowance);
    }

    /**
     * @dev Updates the allowance given to the subscription.
     *
     * Requirements:
     *
     * - caller must be the subscriber.
     */
    function changeAllowance(bytes32 subscriptionId, uint256 newAllowance)
        external
        onlySubscriber(subscriptionId)
    {
        bytes32 planId = subscriptionsDB.getPlanId(subscriptionId);

        require(newAllowance >= plansDB.getMinAllowance(planId), "ODS: insufficient allowance");

        subscriptionsDB.setAllowance(subscriptionId, newAllowance);

        emit AllowanceUpdated(planId, subscriptionId, newAllowance);
    }

    /**
     * @dev Cancels the subscription.
     *
     * Requirements:
     *
     * - caller must be the subscriber.
     */
    function cancel(bytes32 subscriptionId) external onlySubscriber(subscriptionId) {
        bytes32 planId = subscriptionsDB.getPlanId(subscriptionId);

        subscriptionsDB.setSubscriptionId(planId, msg.sender, bytes32(0));
        subscriptionsDB.setAccount(subscriptionId, address(0));
        subscriptionsDB.setPlanId(subscriptionId, bytes32(0));
        subscriptionsDB.setSubscribedAt(subscriptionId, 0);
        subscriptionsDB.setAllowance(subscriptionId, 0);
        subscriptionsDB.setSpent(subscriptionId, 0);
        subscriptionsDB.setLatestBilling(subscriptionId, 0);

        emit SubscriptionCancelled(planId, subscriptionId);
    }

    /**
     * @dev Returns the subscription given its id.
     */
    function getSubscription(bytes32 subscriptionId)
        external
        view
        returns (
            address account,
            bytes32 planId,
            uint256 subscribedAt,
            uint256 spent,
            uint256 allowance,
            uint256 latestBilling,
            uint256 cycleStart,
            uint256 cycleEnd
        )
    {
        require(exists(subscriptionId), "ODS: invalid subscription id");

        account = subscriptionsDB.getAccount(subscriptionId);
        planId = subscriptionsDB.getPlanId(subscriptionId);
        subscribedAt = subscriptionsDB.getSubscribedAt(subscriptionId);
        allowance = subscriptionsDB.getAllowance(subscriptionId);
        latestBilling = subscriptionsDB.getLatestBilling(subscriptionId);

        uint256 period = plansDB.getPeriod(planId);

        cycleStart = subscribedAt + (block.timestamp - subscribedAt) / period * period;
        cycleEnd = cycleStart + period - 1;

        if (latestBilling >= cycleStart && latestBilling <= cycleEnd) {
            spent = subscriptionsDB.getSpent(subscriptionId);
        }
    }

    /**
     * @dev Returns the id of the currently active subscription of `account` to the plan.
     */
    function getSubscriptionId(bytes32 planId, address account)
        external
        view
        returns (bytes32)
    {
        require(isSubscribed(planId, account), "ODS: user is not subscribed");

        return subscriptionsDB.getSubscriptionId(planId, account);
    }

    /**
     * @dev Returns true if the subscription exists
     */
    function exists(bytes32 subscriptionId) public view returns (bool) {
        return subscriptionsDB.getAccount(subscriptionId) != address(0);
    }

    /**
     * @dev Returns true if `account` is currently subscribed to the plan.
     */
    function isSubscribed(bytes32 planId, address account) public view returns (bool) {
        return subscriptionsDB.getSubscriptionId(planId, account) != bytes32(0);
    }
}
