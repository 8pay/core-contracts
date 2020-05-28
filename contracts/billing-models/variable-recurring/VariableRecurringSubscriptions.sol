// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IVariableRecurringPlansDatabase } from "../../interfaces/IVariableRecurringPlansDatabase.sol";
import { IVariableRecurringSubscriptionsDatabase } from "../../interfaces/IVariableRecurringSubscriptionsDatabase.sol";
import { VariableRecurringConstants } from "./VariableRecurringConstants.sol";

/**
 * @dev This contract allows customers to adhere to variable recurring plans
 * thus creating a subscription. Subscriptions allow the vendor to
 * charge customers on a recurring basis.
 *
 * The variable recurring billing models expects payments to be made in arrears
 * so the first billing will be performed at the end of the first cycle.
 *
 * In order to cancel a subscription, a request must be forwarded to the vendor
 * who will perform a final bill corresponding to the resources used up to that moment.
 * After this last billing is performed successfully, the subscription will be
 * automatically cancelled.
 */
contract VariableRecurringSubscriptions is VariableRecurringConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IVariableRecurringPlansDatabase public plansDB;
    IVariableRecurringSubscriptionsDatabase public subscriptionsDB;

    /**
     * @dev Emitted when `account` subscribes to the plan.
     */
    event Subscription(bytes32 indexed planId, bytes32 indexed subscriptionId, address indexed account);

    /**
     * @dev Emitted when a cancellation has been requested for a subscription.
     */
    event SubscriptionCancellationRequested(bytes32 indexed planId, bytes32 indexed subscriptionId);

    /**
     * @dev Modifier that check if the caller is the subscriber.
     */
    modifier onlySubscriber(bytes32 subscriptionId) {
        require(
            subscriptionsDB.getAccount(subscriptionId) == msg.sender,
            "VRS: caller is not the subscriber"
        );

        _;
    }

    /**
     * @dev Initializes contracts references.
     */
    function initialize(
        IVariableRecurringPlansDatabase plansDB_,
        IVariableRecurringSubscriptionsDatabase subscriptionsDB_
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
    function subscribe(bytes32 planId) external {
        require(plansDB.getAdmin(planId) != address(0), "VRS: invalid plan id");
        require(!isSubscribed(planId, msg.sender), "VRS: user is already subscribed");

        bytes32 subscriptionId = keccak256(abi.encodePacked(planId, msg.sender, block.timestamp));

        subscriptionsDB.setSubscriptionId(planId, msg.sender, subscriptionId);
        subscriptionsDB.setAccount(subscriptionId, msg.sender);
        subscriptionsDB.setPlanId(subscriptionId, planId);
        subscriptionsDB.setSubscribedAt(subscriptionId, block.timestamp);
        subscriptionsDB.setCycleStart(subscriptionId, block.timestamp);

        emit Subscription(planId, subscriptionId, msg.sender);
    }

    /**
     * @dev Requests the cancellation of the subscription.
     *
     * Requirements:
     *
     * - caller must be the subscriber
     */
    function requestCancellation(bytes32 subscriptionId)
        external
        onlySubscriber(subscriptionId)
    {
        require(
            subscriptionsDB.getCancellationRequest(subscriptionId) == 0,
            "VRS: cancellation already requested"
        );

        subscriptionsDB.setCancellationRequest(subscriptionId, block.timestamp);

        emit SubscriptionCancellationRequested(
            subscriptionsDB.getPlanId(subscriptionId),
            subscriptionId
        );
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
            uint256 cycleEnd,
            uint256 cancellationRequest
        )
    {
        require(exists(subscriptionId), "VRS: invalid subscription id");

        account = subscriptionsDB.getAccount(subscriptionId);
        planId = subscriptionsDB.getPlanId(subscriptionId);
        subscribedAt = subscriptionsDB.getSubscribedAt(subscriptionId);
        cycleStart = subscriptionsDB.getCycleStart(subscriptionId);
        cycleEnd = cycleStart + plansDB.getPeriod(planId) - 1;
        cancellationRequest = subscriptionsDB.getCancellationRequest(subscriptionId);
    }

    /**
     * @dev Returns the id of the currently active subscription of `account` to the plan.
     */
    function getSubscriptionId(bytes32 planId, address account)
        external
        view
        returns (bytes32)
    {
        require(isSubscribed(planId, account), "VRS: user is not subscribed");

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
