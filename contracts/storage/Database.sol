// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/**
 * @dev The Database contract provides a generic key-value storage that can
 * be extended to fit any need.
 */
abstract contract Database {
    mapping (bytes32 => uint256) private _uintStorage;
    mapping (bytes32 => string) private _stringStorage;
    mapping (bytes32 => address) private _addressStorage;
    mapping (bytes32 => bytes) private _bytesStorage;
    mapping (bytes32 => bool) private _boolStorage;
    mapping (bytes32 => int256) private _intStorage;
    mapping (bytes32 => bytes32) private _bytes32Storage;

    mapping (bytes32 => uint256[]) private _uintArrayStorage;
    mapping (bytes32 => string[]) private _stringArrayStorage;
    mapping (bytes32 => address[]) private _addressArrayStorage;
    mapping (bytes32 => bytes[]) private _bytesArrayStorage;
    mapping (bytes32 => bool[]) private _boolArrayStorage;
    mapping (bytes32 => int256[]) private _intArrayStorage;
    mapping (bytes32 => bytes32[]) private _bytes32ArrayStorage;

    /**
     * @dev Sets a uint `value` on the given `key`.
     */
    function _setUint(bytes32 key, uint256 value) internal {
        _uintStorage[key] = value;
    }

    /**
     * @dev Sets a string `value` on the given `key`.
     */
    function _setString(bytes32 key, string memory value) internal {
        _stringStorage[key] = value;
    }

    /**
     * @dev Sets an address `value` on the given `key`.
     */
    function _setAddress(bytes32 key, address value) internal {
        _addressStorage[key] = value;
    }

    /**
     * @dev Sets a bytes `value` on the given `key`.
     */
    function _setBytes(bytes32 key, bytes memory value) internal {
        _bytesStorage[key] = value;
    }

    /**
     * @dev Sets a bool `value` on the given `key`.
     */
    function _setBool(bytes32 key, bool value) internal {
        _boolStorage[key] = value;
    }

    /**
     * @dev Sets an int `value` on the given `key`.
     */
    function _setInt(bytes32 key, int256 value) internal {
        _intStorage[key] = value;
    }

    /**
     * @dev Sets a bytes32 `value` on the given `key`.
     */
    function _setBytes32(bytes32 key, bytes32 value) internal {
        _bytes32Storage[key] = value;
    }

    /**
     * @dev Sets a uint array `value` on the given `key`.
     */
    function _setUintArray(bytes32 key, uint256[] memory value) internal {
        _uintArrayStorage[key] = value;
    }

    /**
     * @dev Sets a string array `value` on the given `key`.
     */
    function _setStringArray(bytes32 key, string[] memory value) internal {
        _stringArrayStorage[key] = value;
    }

    /**
     * @dev Sets an address array `value` on the given `key`.
     */
    function _setAddressArray(bytes32 key, address[] memory value) internal {
        _addressArrayStorage[key] = value;
    }

    /**
     * @dev Sets a bytes array `value` on the given `key`.
     */
    function _setBytesArray(bytes32 key, bytes[] memory value) internal {
        _bytesArrayStorage[key] = value;
    }

    /**
     * @dev Sets a bool array `value` on the given `key`.
     */
    function _setBoolArray(bytes32 key, bool[] memory value) internal {
        _boolArrayStorage[key] = value;
    }

    /**
     * @dev Sets an int array `value` on the given `key`.
     */
    function _setIntArray(bytes32 key, int256[] memory value) internal {
        _intArrayStorage[key] = value;
    }

    /**
     * @dev Sets a bytes32 array `value` on the given `key`.
     */
    function _setBytes32Array(bytes32 key, bytes32[] memory value) internal {
        _bytes32ArrayStorage[key] = value;
    }

    /**
     * @dev Deletes the uint value stored with the given `key`.
     */
    function _deleteUint(bytes32 key) internal {
        delete _uintStorage[key];
    }

    /**
     * @dev Deletes the string value stored with the given `key`.
     */
    function _deleteString(bytes32 key) internal {
        delete _stringStorage[key];
    }

    /**
     * @dev Deletes the address value stored with the given `key`.
     */
    function _deleteAddress(bytes32 key) internal {
        delete _addressStorage[key];
    }

    /**
     * @dev Deletes the bytes value stored with the given `key`.
     */
    function _deleteBytes(bytes32 key) internal {
        delete _bytesStorage[key];
    }

    /**
     * @dev Deletes the bool value stored with the given `key`.
     */
    function _deleteBool(bytes32 key) internal {
        delete _boolStorage[key];
    }

    /**
     * @dev Deletes the int value stored with the given `key`.
     */
    function _deleteInt(bytes32 key) internal {
        delete _intStorage[key];
    }

    /**
     * @dev Deletes the bytes32 value stored with the given `key`.
     */
    function _deleteBytes32(bytes32 key) internal {
        delete _bytes32Storage[key];
    }

    /**
     * @dev Deletes the uint array value stored with the given `key`.
     */
    function _deleteUintArray(bytes32 key) internal {
        delete _uintArrayStorage[key];
    }

    /**
     * @dev Deletes the string array value stored with the given `key`.
     */
    function _deleteStringArray(bytes32 key) internal {
        delete _stringArrayStorage[key];
    }

    /**
     * @dev Deletes the address array value stored with the given `key`.
     */
    function _deleteAddressArray(bytes32 key) internal {
        delete _addressArrayStorage[key];
    }

    /**
     * @dev Deletes the bytes array value stored with the given `key`.
     */
    function _deleteBytesArray(bytes32 key) internal {
        delete _bytesArrayStorage[key];
    }

    /**
     * @dev Deletes the bool array value stored with the given `key`.
     */
    function _deleteBoolArray(bytes32 key) internal {
        delete _boolArrayStorage[key];
    }

    /**
     * @dev Deletes the int array value stored with the given `key`.
     */
    function _deleteIntArray(bytes32 key) internal {
        delete _intArrayStorage[key];
    }

    /**
     * @dev Deletes the bytes32 array value stored with the given `key`.
     */
    function _deleteBytes32Array(bytes32 key) internal {
        delete _bytes32ArrayStorage[key];
    }

    /**
     * @dev Returns the uint value stored with the given `key`.
     */
    function _getUint(bytes32 key) internal view returns(uint256) {
        return _uintStorage[key];
    }

    /**
     * @dev Returns the string value stored with the given `key`.
     */
    function _getString(bytes32 key) internal view returns(string memory) {
        return _stringStorage[key];
    }

    /**
     * @dev Returns the address value stored with the given `key`.
     */
    function _getAddress(bytes32 key) internal view returns(address) {
        return _addressStorage[key];
    }

    /**
     * @dev Returns the bytes value stored with the given `key`.
     */
    function _getBytes(bytes32 key) internal view returns(bytes memory) {
        return _bytesStorage[key];
    }

    /**
     * @dev Returns the bool value stored with the given `key`.
     */
    function _getBool(bytes32 key) internal view returns(bool) {
        return _boolStorage[key];
    }

    /**
     * @dev Returns the int value stored with the given `key`.
     */
    function _getInt(bytes32 key) internal view returns(int256) {
        return _intStorage[key];
    }

    /**
     * @dev Returns the bytes32 value stored with the given `key`.
     */
    function _getBytes32(bytes32 key) internal view returns(bytes32) {
        return _bytes32Storage[key];
    }

    /**
     * @dev Returns the uint array value stored with the given `key`.
     */
    function _getUintArray(bytes32 key) internal view returns(uint256[] memory) {
        return _uintArrayStorage[key];
    }

    /**
     * @dev Returns the string array value stored with the given `key`.
     */
    function _getStringArray(bytes32 key) internal view returns(string[] memory) {
        return _stringArrayStorage[key];
    }

    /**
     * @dev Returns the address array value stored with the given `key`.
     */
    function _getAddressArray(bytes32 key) internal view returns(address[] memory) {
        return _addressArrayStorage[key];
    }

    /**
     * @dev Returns the bytes array value stored with the given `key`.
     */
    function _getBytesArray(bytes32 key) internal view returns(bytes[] memory) {
        return _bytesArrayStorage[key];
    }

    /**
     * @dev Returns the bool array value stored with the given `key`.
     */
    function _getBoolArray(bytes32 key) internal view returns(bool[] memory) {
        return _boolArrayStorage[key];
    }

    /**
     * @dev Returns the int array value stored with the given `key`.
     */
    function _getIntArray(bytes32 key) internal view returns(int256[] memory) {
        return _intArrayStorage[key];
    }

    /**
     * @dev Returns the bytes32 array value stored with the given `key`.
     */
    function _getBytes32Array(bytes32 key) internal view returns(bytes32[] memory) {
        return _bytes32ArrayStorage[key];
    }
}
