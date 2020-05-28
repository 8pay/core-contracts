// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { IFeeProvider } from "../interfaces/IFeeProvider.sol";

/**
 * @dev Mock contract used in tests to always return the same fee.
 */
contract FeeProviderMock is IFeeProvider {
    uint256 private _fee;

    constructor(uint256 fee) {
        _fee = fee;
    }

    function getFee(address /*account*/, bytes32 /*paymentType*/)
        external
        view
        override
        returns (uint256)
    {
        return _fee;
    }
}
