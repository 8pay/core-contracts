// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../libraries/Arrays.sol";

/**
 * @dev Mock contract used to test Arrays library.
 */
contract ArraysMock {
    function sumUint256(uint256[] memory array) external pure returns (uint256) {
        return Arrays.sum(array);
    }

    function hasDuplicatesBytes32(bytes32[] memory array) external pure returns (bool) {
        return Arrays.hasDuplicates(array);
    }
}
