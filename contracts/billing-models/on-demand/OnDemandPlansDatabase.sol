// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { AccessControl } from "../../access/AccessControl.sol";
import { Database } from "../../storage/Database.sol";
import { IOnDemandPlansDatabase } from "../../interfaces/IOnDemandPlansDatabase.sol";

/**
 * @dev This contract stores all data related to plans of the on demand billing model.
 */
contract OnDemandPlansDatabase is IOnDemandPlansDatabase, Database, AccessControl {
    /**
     * @dev Sets the `admin` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setAdmin(bytes32 planId, address admin)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setAddress(_getPlanFieldKey(planId, "admin"), admin);
    }

    /**
     * @dev Sets the `minAllowance` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setMinAllowance(bytes32 planId, uint256 minAllowance)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getPlanFieldKey(planId, "minAllowance"), minAllowance);
    }

    /**
     * @dev Sets the `period` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setPeriod(bytes32 planId, uint256 period)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getPlanFieldKey(planId, "period"), period);
    }

    /**
     * @dev Sets the `token` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setToken(bytes32 planId, address token)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setAddress(_getPlanFieldKey(planId, "token"), token);
    }

    /**
     * @dev Sets the `receiver` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setReceiver(bytes32 planId, address receiver)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setAddress(_getPlanFieldKey(planId, "receiver"), receiver);
    }

    /**
     * @dev Sets the `permission` for `account` on the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setPermission(bytes32 planId, bytes32 permission, address account, bool value)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setBool(_getPermissionFieldKey(planId, permission, account), value);
    }

    /**
     * @dev Returns the admin of the plan.
     */
    function getAdmin(bytes32 planId) external view override returns (address) {
        return _getAddress(_getPlanFieldKey(planId, "admin"));
    }

    /**
     * @dev Returns the min allowance of the plan.
     */
    function getMinAllowance(bytes32 planId) external view override returns (uint256) {
        return _getUint(_getPlanFieldKey(planId, "minAllowance"));
    }

    /**
     * @dev Returns the period of the plan.
     */
    function getPeriod(bytes32 planId) external view override returns (uint256) {
        return _getUint(_getPlanFieldKey(planId, "period"));
    }

    /**
     * @dev Returns the token of the plan.
     */
    function getToken(bytes32 planId) external view override returns (address) {
        return _getAddress(_getPlanFieldKey(planId, "token"));
    }

    /**
     * @dev Returns the receiver of the plan.
     */
    function getReceiver(bytes32 planId)
        external
        view
        override
        returns (address)
    {
        return _getAddress(_getPlanFieldKey(planId, "receiver"));
    }

    /**
     * @dev Returns true if the account has the given permission on the plan.
     */
    function hasPermission(bytes32 planId, bytes32 permission, address account)
        external
        view
        override
        returns (bool)
    {
        return _getBool(_getPermissionFieldKey(planId, permission, account));
    }

    /**
     * @dev Returns an hash to be used as key for storing a plan's field.
     */
    function _getPlanFieldKey(bytes32 planId, string memory field)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(planId, field));
    }

    /**
     * @dev Returns an hash to be used as key for storing a permission of an account on a plan.
     */
    function _getPermissionFieldKey(bytes32 planId, bytes32 permission, address account)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(planId, permission, account));
    }
}
