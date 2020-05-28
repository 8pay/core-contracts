// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Arrays } from "../../libraries/Arrays.sol";
import { IOnDemandPlansDatabase } from "../../interfaces/IOnDemandPlansDatabase.sol";
import { ITokensRegistry } from "../../interfaces/ITokensRegistry.sol";
import { OnDemandConstants } from "./OnDemandConstants.sol";

/**
 * @dev The contract manages the plans for the on-demand billing model.
 *
 * The on demand billing model provides recurring payment on a per-usage basis.
 * Billing are performed without following predefined time intervals.
 *
 * In order to provide a flexible and safe customer experience, the customers who
 * subscribe to an on demand plan will be able to set a maximum allowance to
 * be given to the subscription over the period of time defined by the plan.
 *
 * If the plan's period is 7 days and the allowance given by the customer is 100 token,
 * the vendor will be able to execute and unlimited number of billings in those
 * of 7 days as long as the total amount does not exceed customer allowance.
 *
 * To avoid customers subscribing with an allowance that is too low for the provided
 * service, the vendor is able to set a minimum allowance during the creation of the plan.
 *
 * A plan defines the minimum allowance, the token, the period, the category and
 * the accounts that will receive the payments from the customers.
 *
 * By default, the account that creates the plan is also admin of the plan.
 * To facilitate administrative operations on subscriptions, special permissions can
 * be granted to other accounts, such as the permission to terminate subscriptions.
 *
 */
contract OnDemandPlans is OnDemandConstants, Initializable {
    /// @dev Reserved memory slots
    uint256[50] private __gap;

    IOnDemandPlansDatabase public plansDB;
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
        uint256 minAllowance,
        address token,
        uint256 period,
        string category,
        address[] receivers,
        uint256[] percentages
    );

    /**
     * @dev Emitted when the receivers of a plan have been changed
     */
    event ReceiversChanged(bytes32 indexed planId, address[] receivers, uint256[] percentages);

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
        require(isAdmin(planId, msg.sender), "ODP: caller is not plan's admin");
        _;
    }

    /**
     * @dev Modifier that checks if `permission` is valid.
     */
    modifier validPermission(bytes32 permission) {
        require(
            permission == PERMISSION_BILL || permission == PERMISSION_TERMINATE,
            "ODP: invalid permission"
        );
        _;
    }

    /**
     * @dev Initializes contract references.
     */
    function initialize(
        IOnDemandPlansDatabase plansDB_,
        ITokensRegistry tokensRegistry_
    )
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
        uint256 minAllowance,
        address token,
        uint256 period,
        string memory category,
        address[] memory receivers,
        uint256[] memory percentages
    )
        external
    {
        require(minAllowance != 0, "ODP: min allowance is zero");
        require(period >= MIN_PERIOD, "ODP: period is too short");
        require(bytes(name).length != 0, "ODP: name is empty");
        require(tokensRegistry.isActive(token), "ODP: token is not supported");

        _validateReceivers(receivers, percentages);

        bytes32 planId = keccak256(abi.encodePacked(
            PAYMENT_TYPE,
            msg.sender,
            name,
            minAllowance,
            token,
            period,
            block.timestamp
        ));

        require(!exists(planId), "ODP: plan already exists");

        plansDB.setAdmin(planId, msg.sender);
        plansDB.setToken(planId, token);
        plansDB.setPeriod(planId, period);
        plansDB.setMinAllowance(planId, minAllowance);
        plansDB.setReceivers(planId, receivers);
        plansDB.setPercentages(planId, percentages);

        emit PlanCreated(
            planId,
            msg.sender,
            name,
            minAllowance,
            token,
            period,
            category,
            receivers,
            percentages
        );
    }

    /**
     * @dev Changes the receivers of the given plan.
     *
     * Requirements:
     *
     * - caller must be admin of the plan
     */
    function changeReceivers(bytes32 planId, address[] memory receivers, uint256[] memory percentages)
        external
        onlyAdmin(planId)
    {
        _validateReceivers(receivers, percentages);

        plansDB.setReceivers(planId, receivers);
        plansDB.setPercentages(planId, percentages);

        emit ReceiversChanged(planId, receivers, percentages);
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
            uint256 minAllowance,
            uint256 period,
            address token,
            address[] memory receivers,
            uint256[] memory percentages
        )
    {
        require(exists(planId), "ODP: invalid plan id");

        admin = plansDB.getAdmin(planId);
        period = plansDB.getPeriod(planId);
        minAllowance = plansDB.getMinAllowance(planId);
        token = tokensRegistry.getLatestAddress(plansDB.getToken(planId));
        receivers = plansDB.getReceivers(planId);
        percentages = plansDB.getPercentages(planId);
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
    function _validateReceivers(address[] memory receivers, uint256[] memory percentages)
        internal
        pure
    {
        require(
            receivers.length == percentages.length,
            "ODP: parameters length mismatch"
        );

        require(
            receivers.length > 0 && receivers.length <= MAX_RECEIVERS,
            "ODP: invalid receivers length"
        );

        for (uint256 i = 0; i < receivers.length; i++){
            require(receivers[i] != address(0), "ODP: receiver is the zero address");
            require(percentages[i] != 0, "ODP: percentage is zero");
        }

        require(Arrays.sum(percentages) == 10000, "ODP: invalid percentages");
    }
}
