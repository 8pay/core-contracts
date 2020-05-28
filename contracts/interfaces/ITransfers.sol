// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface ITransfers {
    function transfer(
        address token,
        address sender,
        address[] calldata receivers,
        uint256[] calldata amounts,
        address feeAccount,
        bytes32 paymentType,
        bytes32 metadata
    ) external payable returns (bool success);

    function batchTransfers(
        address token,
        address[] calldata senders,
        address[] calldata receivers,
        uint256[][] calldata amounts,
        address feeAccount,
        bytes32 paymentType,
        bytes32[] calldata metadata
    ) external returns (bool[] memory success);
}
