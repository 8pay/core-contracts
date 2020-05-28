// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface ITokensRegistry {
    function isSupported(address token) external view returns (bool);
    function isActive(address token) external view returns (bool);
    function getLatestAddress(address token) external view returns (address);
}
