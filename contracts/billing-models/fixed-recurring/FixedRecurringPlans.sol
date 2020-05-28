// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Arrays } from "../../libraries/Arrays.sol";
import { ITokensRegistry } from "../../interfaces/ITokensRegistry.sol";
import { IFixedRecurringPlansDatabase } from "../../interfaces/IFixedRecurringPlansDatabase.sol";
import { FixedRecurringConstants } from "./FixedRecurringConstants.sol";

/**
 * @dev The contract manages the plans for the fixed recurring billing model.
 *
 * The fixed recurring billing model provides payments of the same amount
 * at regular time intervals.
 *
 * A plan defines the amount, the token, the frequency of billings, the category and
 * the accounts that will receive the payments from the customers.
 *
 * By default, the account that creates the plan is also admin of the plan.
 * To facilitate administrative operations on subscriptions, special permissions can
 * be granted to other accounts, such as the permission to terminate subscriptions.
 */
contract FixedRecurringPlans is FixedRecurringConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IFixedRecurringPlansDatabase public plansDB;
    ITokensRegistry public tokensRegistry;

    uint256 public constant MIN_PERIOD = 600;
    uint256 public constant MAX_RECEIVERS = 5;

    /**
     * @dev Emitted when a plan is created
     */
    event PlanCreated(
        bytes32 indexed id,
        address indexed admin,
        string name,
        address token,
        uint256 period,
        string category,
        address[] receivers,
        uint256[] amounts
    );

    /**
     * @dev Emitted when the receivers of a plan have been changed
     */
    event ReceiversChanged(bytes32 indexed planId, address[] receivers, uint256[] amounts);

    /**
     * @dev Emitted when `permission` is granted to `account`
     */
    event PermissionGranted(bytes32 indexed planId, bytes32 indexed permission, address indexed account);

    /**
     * @dev Emitted when `permission` is revoked from `account`
     */
    event PermissionRevoked(bytes32 indexed planId, bytes32 indexed permission, address indexed account);

    /**
     * @dev Modifier that checks if the caller is the admin of the plan.
     */
    modifier onlyAdmin(bytes32 planId) {
        require(isAdmin(planId, msg.sender), "FRP: caller is not plan's admin");
        _;
    }

    /**
     * @dev Modifier that checks if `permission` is valid.
     */
    modifier validPermission(bytes32 permission) {
        require(permission == PERMISSION_TERMINATE, "FRP: invalid permission");
        _;
    }

    /**
     * @dev Initializes contract references.
     */
    function initialize(IFixedRecurringPlansDatabase plansDB_, ITokensRegistry tokensRegistry_)
        external
        initializer
    {
        plansDB = plansDB_;
        tokensRegistry = tokensRegistry_;
    }

    /**
     * @dev Creates a new plan.
     */
    function createPlan(
        string memory name,
        address token,
        uint256 period,
        string memory category,
        address[] memory receivers,
        uint256[] memory amounts
    )
        external
    {
        require(period >= MIN_PERIOD, "FRP: period is too short");
        require(bytes(name).length != 0, "FRP: name is empty");
        require(tokensRegistry.isActive(token), "FRP: token is not supported");

        _validateReceivers(receivers, amounts);

        bytes32 planId = keccak256(abi.encodePacked(
            PAYMENT_TYPE,
            msg.sender,
            name,
            Arrays.sum(amounts),
            token,
            period,
            block.timestamp
        ));

        require(!exists(planId), "FRP: plan already exists");

        plansDB.setAdmin(planId, msg.sender);
        plansDB.setToken(planId, token);
        plansDB.setPeriod(planId, period);
        plansDB.setReceivers(planId, receivers);
        plansDB.setAmounts(planId, amounts);

        emit PlanCreated(
            planId,
            msg.sender,
            name,
            token,
            period,
            category,
            receivers,
            amounts
        );
    }

    /**
     * @dev Changes the receivers of the given plan.
     *
     * Requirements:
     *
     * - caller must be admin of the plan
     * - the new total amount must be equal to the old total amount
     */
    function changeReceivers(
        bytes32 planId,
        address[] memory receivers,
        uint256[] memory amounts
    )
        external
        onlyAdmin(planId)
    {
        _validateReceivers(receivers, amounts);

        uint256[] memory prevAmounts = plansDB.getAmounts(planId);

        require(
            Arrays.sum(amounts) == Arrays.sum(prevAmounts),
            "FRP: invalid amounts"
        );

        plansDB.setReceivers(planId, receivers);
        plansDB.setAmounts(planId, amounts);

        emit ReceiversChanged(planId, receivers, amounts);
    }

    /**
     * @dev Grants `permission` on the plan to `accounts`.
     *
     * If they had not already been granted `permission`, emits {PermissionGranted} event.
     *
     * Requirements:
     *
     * - caller must be admin of the plan
     */
    function grantPermission(bytes32 planId, bytes32 permission, address[] memory accounts)
        external
        onlyAdmin(planId)
        validPermission(permission)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (!hasPermission(planId, permission, accounts[i])) {
                plansDB.setPermission(planId, permission, accounts[i], true);

                emit PermissionGranted(planId, permission, accounts[i]);
            }
        }
    }

    /**
     * @dev Revokes `permission` from `accounts` on the plan.
     *
     * If they had been granted `permission`, emits {PermissionRevoked} event.
     *
     * Requirements:
     *
     * - caller must be admin of the plan
     */
    function revokePermission(bytes32 planId, bytes32 permission, address[] memory accounts)
        external
        onlyAdmin(planId)
        validPermission(permission)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (hasPermission(planId, permission, accounts[i])) {
                plansDB.setPermission(planId, permission, accounts[i], false);

                emit PermissionRevoked(planId, permission, accounts[i]);
            }
        }
    }

    /**
     * @dev Returns the plan identified by `planId`.
     */
    function getPlan(bytes32 planId)
        external
        view
        returns(
            address admin,
            uint256 period,
            address token,
            address[] memory receivers,
            uint256[] memory amounts
        )
    {
        require(exists(planId), "FRP: invalid plan id");

        admin = plansDB.getAdmin(planId);
        period = plansDB.getPeriod(planId);
        token = tokensRegistry.getLatestAddress(plansDB.getToken(planId));
        receivers = plansDB.getReceivers(planId);
        amounts = plansDB.getAmounts(planId);
    }

    /**
     * @dev Returns true if the plan exists.
     */
    function exists(bytes32 planId) public view returns (bool) {
        return plansDB.getAdmin(planId) != address(0);
    }

    /**
     * @dev Returns true if `account` is the admin of the plan.
     */
    function isAdmin(bytes32 planId, address account) public view returns (bool) {
        return plansDB.getAdmin(planId) == account;
    }

    /**
     * @dev Returns true if `account` has been granted `permission`.
     */
    function hasPermission(bytes32 planId, bytes32 permission, address account)
        public
        view
        returns (bool)
    {
        return plansDB.hasPermission(planId, permission, account);
    }

    /**
     * @dev Validates receivers and throws if they are invalid.
     */
    function _validateReceivers(address[] memory receivers, uint256[] memory amounts)
        internal
        pure
    {
        require(
            receivers.length == amounts.length,
            "FRP: parameters length mismatch"
        );
        require(
            receivers.length > 0 && receivers.length <= MAX_RECEIVERS,
            "FRP: invalid receivers length"
        );

        for (uint256 i = 0; i < receivers.length; i++){
            require(receivers[i] != address(0), "FRP: receiver is zero address");
            require(amounts[i] != 0, "FRP: amount is zero");
        }
    }
}
