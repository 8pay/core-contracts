// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions.
 *
 * Roles can be granted and revoked dynamically by accounts with the OWNER_ROLE
 * via the {grantRole} and {revokeRole} functions.
 */
abstract contract AccessControl {
    struct RoleData {
        mapping (address => bool) members;
    }

    bool private _initialized;
    mapping (bytes32 => RoleData) private _roles;

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant NETWORK_CONTRACT_ROLE = keccak256("NETWORK_CONTRACT_ROLE");

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call, an owner role
     * bearer except when using {initAccessControl}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the owner role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Modifier that checks that an account has a specific role.
     */
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: permission denied");
        _;
    }

    /**
     * @dev Initializes access control granting `roles` to the provided `accounts`.
     * The function must be called only once, just after deployment.
     */
    function initAccessControl(bytes32[] memory roles, address[] memory accounts)
        external
    {
        require(!_initialized, "AccessControl: already initialized");
        require(roles.length == accounts.length, "AccessControl: parameters length mismatch");

        bool hasAtLeastAnOwner;

        for (uint256 i = 0; i < roles.length; i++) {
            if (roles[i] == OWNER_ROLE) {
                hasAtLeastAnOwner = true;
            }

            _grantRole(roles[i], accounts[i]);
        }

        require(hasAtLeastAnOwner, "AccessControl: no owner provided");

        _initialized = true;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted} event.
     *
     * Requirements:
     *
     * - the caller must have owner role.
     */
    function grantRole(bytes32 role, address account) external onlyRole(OWNER_ROLE) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have owner role.
     */
    function revokeRole(bytes32 role, address account) external onlyRole(OWNER_ROLE) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * Requirements:
     *
     * - the caller must have been granted `role`.
     */
    function renounceRole(bytes32 role) external onlyRole(role) {
        _revokeRole(role, msg.sender);
    }

    /**
     * @dev Returns true if account has been granted role.
     */
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role].members[account];
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event. Note that unlike {grantRole}, this function doesn't perform any
     * checks on the calling account.
     */
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role].members[account] = true;

            emit RoleGranted(role, account, msg.sender);
        }
    }

    /**
     * @dev Revokes `role` from `account`..
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     * Note that unlike {revokeRole}, this function doesn't perform any
     * checks on the calling account.
     */
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role].members[account] = false;

            emit RoleRevoked(role, account, msg.sender);
        }
    }
}
