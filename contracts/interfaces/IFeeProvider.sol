// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IFeeProvider {
    function getFee(address account, bytes32 paymentType)
        external
        view
        returns (uint256 fee);
}
