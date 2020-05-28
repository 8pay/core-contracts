// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/**
 * @dev A library to manipulate arrays.
 */
library Arrays {
    /**
     * @dev Returns the sum of all elements in the array.
     */
    function sum(uint256[] memory array)
        internal
        pure
        returns (uint256 total)
    {
        for (uint256 i = 0; i < array.length; i++) {
            total += array[i];
        }
    }

    /**
     * @dev Returns true if the array contains duplicates, false otherwise.
     * Supports arrays of 200 elements at maximum.
     */
    function hasDuplicates(bytes32[] memory array)
        internal
        pure
        returns (bool)
    {
        require(array.length <= 500, "Arrays: length must be below or equal to 500");

        if (array.length == 0 || array.length == 1) {
            return false;
        }

        // A randomly generated offset that is added to each entry in the hash table.
        // Rather than storing additional information on occupancy, we add this offset to each entry.
        // Since the table is initially zeroed out, we consider `0` to mean unoccupied.
        uint256 randomOffset = 0x613c12789c3f663a544355053c9e1e25d50176d60796a155f553aa0f8445ee66;

        // Create hash table initialized to all zeroes
        uint hashTableSize = array.length <= 200 ? 631 : 1231;
        uint[] memory hashTable = new uint[](hashTableSize);
        uint current = uint(array[0]);
        uint i = 1;
        uint hashKey = current % hashTableSize;
        uint hashValue;

        unchecked {
            hashValue = current + randomOffset;
        }

        // Holds the current hash value while searching the hash table
        uint queriedHashValue;

        // Record first element in hashTable
        hashTable[hashKey] = hashValue;

        while (i != array.length) {
            // Pick next element
            current = uint(array[i]);
            unchecked {
                hashValue = current + randomOffset;
            }
            hashKey = current % hashTableSize;
            queriedHashValue = hashTable[hashKey];

            // Keep searching until we find our value or a 0 location
            while (queriedHashValue != hashValue && queriedHashValue != 0) {
                hashKey = (hashKey + 1) % hashTableSize;
                queriedHashValue = hashTable[hashKey];
            }

            // Check if it's a duplicate
            if (queriedHashValue == hashValue) {
                return true;
            }

            // The element is unique, record in hashTable
            hashTable[hashKey] = hashValue;
            i++;
        }

        return false;
    }

    /**
     * @dev Shrink arrays size to the specified length.
     */
    function shrink(bytes32[] memory array, uint256 length)
        internal
        pure
    {
        require(array.length >= length, "Array too small");

        uint256 extraElementsCount = array.length - length;

        assembly { mstore(array, sub(mload(array), extraElementsCount)) }
    }

    /**
     * @dev Shrink arrays size to the specified length.
     */
    function shrink(uint256[] memory array, uint256 length)
        internal
        pure
    {
        require(array.length >= length, "Array too small");

        uint256 extraElementsCount = array.length - length;

        assembly { mstore(array, sub(mload(array), extraElementsCount)) }
    }

    /**
     * @dev Shrink arrays size to the specified length.
     */
    function shrink(bool[] memory array, uint256 length)
        internal
        pure
    {
        require(array.length >= length, "Array too small");

        uint256 extraElementsCount = array.length - length;

        assembly { mstore(array, sub(mload(array), extraElementsCount)) }
    }
}
