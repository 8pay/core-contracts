// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ITransfers } from "../../interfaces/ITransfers.sol";
import { IFixedRecurringPlansDatabase } from "../../interfaces/IFixedRecurringPlansDatabase.sol";
import { IFixedRecurringSubscriptionsDatabase } from "../../interfaces/IFixedRecurringSubscriptionsDatabase.sol";
import { FixedRecurringConstants } from "./FixedRecurringConstants.sol";

/**
 * @dev This contract allows customers to adhere to fixed recurring plans
 * thus creating a subscription. Subscriptions allow the vendor to
 * charge customers on a recurring basis.
 *
 * Since the fixed recurring billing models expects payments to be made in advance,
 * the first billing will be executed at the time of subscription.
 *
 * The first cycle will start immediately after the first billing and another
 * payment will be due at the end of it.
 *
 * Subscriptions can be cancelled anytime and no more billings can be performed
 * after cancellation.
 */
contract FixedRecurringSubscriptions is FixedRecurringConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IFixedRecurringPlansDatabase public plansDB;
    IFixedRecurringSubscriptionsDatabase public subscriptionsDB;
    ITransfers public transfers;

    /**
     * @dev Emitted when `account` subscribes to the plan.
     */
    event Subscription(bytes32 indexed planId, bytes32 indexed subscriptionId, address indexed account);

    /**
     * @dev Emitted when a subscription is cancelled.
     */
    event SubscriptionCancelled(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Emitted when a billing is performed on a subscription.
     */
    event Billing(bytes32 indexed planId, bytes32 indexed subscriptionId, uint256 cycleStart, uint256 cycleEnd);

    /**
     * @dev Modifier that check if the caller is the subscriber.
     */
    modifier onlySubscriber(bytes32 subscriptionId) {
        require(
            subscriptionsDB.getAccount(subscriptionId) == msg.sender,
            "FRS: caller is not the subscriber"
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
     * @dev Subscribes the caller to the given plan and performs the first billing.
     *
     * Requirements:
     *
     * - the caller must not be already subscribed to the same plan.
     */
    function subscribe(bytes32 planId) external {
        address planAdmin = plansDB.getAdmin(planId);

        require(planAdmin != address(0), "FRS: invalid plan id");
        require(!isSubscribed(planId, msg.sender), "FRS: user is already subscribed");

        bytes32 subscriptionId = keccak256(abi.encodePacked(planId, msg.sender, block.timestamp));

        uint256[] memory amounts = new uint256[](1);
        address[] memory receivers = new address[](1);

        receivers[0] = plansDB.getReceiver(planId);
        amounts[0] = plansDB.getAmount(planId);

        require(
            transfers.transfer(
                plansDB.getToken(planId),
                msg.sender,
                receivers,
                amounts,
                planAdmin,
                PAYMENT_TYPE,
                subscriptionId
            ),
            "FRS: transfer failed"
        );

        uint256 period = plansDB.getPeriod(planId);

        subscriptionsDB.setAccount(subscriptionId, msg.sender);
        subscriptionsDB.setPlanId(subscriptionId, planId);
        subscriptionsDB.setSubscribedAt(subscriptionId, block.timestamp);
        subscriptionsDB.setCycleStart(subscriptionId, block.timestamp);
        subscriptionsDB.setSubscriptionId(planId, msg.sender, subscriptionId);

        emit Subscription(planId, subscriptionId, msg.sender);
        emit Billing(planId, subscriptionId, block.timestamp, block.timestamp + period - 1);
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

        subscriptionsDB.setAccount(subscriptionId, address(0));
        subscriptionsDB.setPlanId(subscriptionId, bytes32(0));
        subscriptionsDB.setSubscribedAt(subscriptionId, 0);
        subscriptionsDB.setCycleStart(subscriptionId, 0);
        subscriptionsDB.setSubscriptionId(planId, msg.sender, bytes32(0));

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
            uint256 cycleStart,
            uint256 cycleEnd
        )
    {
        require(exists(subscriptionId), "FRS: invalid subscription id");

        account = subscriptionsDB.getAccount(subscriptionId);
        planId = subscriptionsDB.getPlanId(subscriptionId);
        subscribedAt = subscriptionsDB.getSubscribedAt(subscriptionId);
        cycleStart = subscriptionsDB.getCycleStart(subscriptionId);
        cycleEnd = cycleStart + plansDB.getPeriod(planId) - 1;
    }

    /**
     * @dev Returns the id of the currently active subscription of `account` to the plan.
     */
    function getSubscriptionId(bytes32 planId, address account)
        external
        view
        returns (bytes32)
    {
        require(isSubscribed(planId, account), "FRS: user is not subscribed");

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
