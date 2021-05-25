// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface ITransfers {
    function transfer(
        address token,
        address sender,
        address receiver,
        uint256 amount,
        address feeAccount,
        bytes32 paymentType,
        bytes32 metadata
    ) external payable returns (bool success);
}
