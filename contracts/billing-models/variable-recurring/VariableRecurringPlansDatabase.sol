// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { AccessControl } from "../../access/AccessControl.sol";
import { Database } from "../../storage/Database.sol";
import { IVariableRecurringPlansDatabase } from "../../interfaces/IVariableRecurringPlansDatabase.sol";

/**
 * @dev This contract stores all data related to plans of the variable recurring billing model.
 */
contract VariableRecurringPlansDatabase is IVariableRecurringPlansDatabase, Database, AccessControl {
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
     * @dev Sets the `maxAmount` of billing of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setMaxAmount(bytes32 planId, uint256 maxAmount)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUint(_getPlanFieldKey(planId, "maxAmount"), maxAmount);
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
     * @dev Sets the `receivers` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setReceivers(bytes32 planId, address[] memory receivers)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setAddressArray(_getPlanFieldKey(planId, "receivers"), receivers);
    }

    /**
     * @dev Sets receivers `percentages` of the plan.
     *
     * Requirements:
     *
     * - caller must be a network contract.
     */
    function setPercentages(bytes32 planId, uint256[] memory percentages)
        external
        override
        onlyRole(NETWORK_CONTRACT_ROLE)
    {
        _setUintArray(_getPlanFieldKey(planId, "percentages"), percentages);
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
    function getAdmin(bytes32 planId)
        external
        view
        override
        returns (address)
    {
        return _getAddress(_getPlanFieldKey(planId, "admin"));
    }

    /**
     * @dev Returns the maximum billing amount of the plan.
     */
    function getMaxAmount(bytes32 planId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getPlanFieldKey(planId, "maxAmount"));
    }

    /**
     * @dev Returns the period of the plan.
     */
    function getPeriod(bytes32 planId)
        external
        view
        override
        returns (uint256)
    {
        return _getUint(_getPlanFieldKey(planId, "period"));
    }

    /**
     * @dev Returns the token of the plan.
     */
    function getToken(bytes32 planId)
        external
        view
        override
        returns (address)
    {
        return _getAddress(_getPlanFieldKey(planId, "token"));
    }

    /**
     * @dev Returns the receivers of the plan.
     */
    function getReceivers(bytes32 planId)
        external
        view
        override
        returns (address[] memory)
    {
        return _getAddressArray(_getPlanFieldKey(planId, "receivers"));
    }

    /**
     * @dev Returns receivers percentages of the plan.
     */
    function getPercentages(bytes32 planId)
        external
        view
        override
        returns (uint256[] memory)
    {
        return _getUintArray(_getPlanFieldKey(planId, "percentages"));
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
