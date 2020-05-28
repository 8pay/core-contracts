// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import { ITokensRegistry } from "../interfaces/ITokensRegistry.sol";
import { AccessControl } from "../access/AccessControl.sol";

/**
 * @dev This contract keeps track of all the tokens supported by the system.
 *
 * Accounts who have been granted the owner role can:
 * - add new tokens
 * - pause/resume tokens in case something bad happens to the token contract
 * - redirect tokens to other addresses in case they are updated (e.g. to V2)
 *
 * The redirect can facilitate merchants who have created plans in the old
 * V1 token as they won't need to create an entire new plan for V2 and make
 * customers manually switch to it.
 */
contract TokensRegistry is ITokensRegistry, AccessControl {
    address[] private _tokens;
    mapping (address => bool) private _supported;
    mapping (address => bool) private _paused;
    mapping (address => address) private _redirects;

    /**
     * @dev Emitted when `token` is added.
     */
    event TokenAdded(address indexed token);

    /**
     * @dev Emitted when `token` is paused.
     */
    event TokenPaused(address indexed token);

    /**
     * @dev Emitted when `token` is resumed.
     */
    event TokenResumed(address indexed token);

    /**
     * @dev Emitted when `token` is redirected to `newToken`.
     */
    event TokenRedirected(address indexed token, address indexed newToken);

    /**
     * @dev Modifier that checks if `token` is supported.
     */
    modifier ifSupported(address token) {
        require(isSupported(token), "TokensRegistry: token is not supported");
        _;
    }

    /**
     * @dev Modifier that checks if `token` is not supported.
     */
    modifier ifNotSupported(address token) {
        require(!isSupported(token), "TokensRegistry: token is already supported");
        _;
    }

    /**
     * @dev Modifier that checks if `token` is active.
     */
    modifier ifActive(address token) {
        require(isActive(token), "TokensRegistry: token is not active");
        _;
    }

    /**
     * @dev Mofifier that checks if `token` is paused.
     */
    modifier ifPaused(address token) {
        require(isSupported(token) && !isActive(token), "TokensRegistry: token is not paused");
        _;
    }

    /**
     * @dev Initializes supported `tokens`.
     */
    constructor(address[] memory tokens) {
        for (uint256 i = 0; i < tokens.length; i++) {
            _tokens.push(tokens[i]);
            _supported[tokens[i]] = true;

            emit TokenAdded(tokens[i]);
        }
    }

    /**
     * @dev Adds support for `token`.
     *
     * Requirements:
     *
     * - caller must have owner role
     * - `token` must not be already supported
     */
    function addToken(address token)
        external
        onlyRole(OWNER_ROLE)
        ifNotSupported(token)
    {
        _tokens.push(token);
        _supported[token] = true;

        emit TokenAdded(token);
    }

    /**
     * @dev Redirect `token` to `newToken`.
     *
     * Requirements:
     *
     * - caller must have owner role
     * - `token` must be supported
     * - `newToken` must be supported
     */
    function setRedirect(address token, address newToken)
        external
        onlyRole(OWNER_ROLE)
        ifSupported(token)
        ifSupported(newToken)
    {
        require(token != newToken, "TokensRegistry: cannot redirect to the same token");

        _redirects[token] = newToken;

        emit TokenRedirected(token, newToken);
    }

    /**
     * @dev Pauses all transfers for `token`.
     *
     * Requirements:
     *
     * - caller must have owner role
     * - `token` must be active
     */
    function pauseToken(address token)
        external
        onlyRole(OWNER_ROLE)
        ifActive(token)
    {
        _paused[token] = true;

        emit TokenPaused(token);
    }

    /**
     * @dev Pauses all transfers for `token`.
     *
     * Requirements:
     *
     * - caller must have owner role
     * - `token` must be paused
     */
    function resumeToken(address token)
        external
        onlyRole(OWNER_ROLE)
        ifPaused(token)
    {
        _paused[token] = false;

        emit TokenResumed(token);
    }

    /**
     * @dev Returns the list of supported tokens.
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return _tokens;
    }

    /**
     * @dev Returns the most recent address for `token`.
     *
     * - If no redirect is in place, returns `token`.
     * - If a redirect is in place, returns the new token.
     */
    function getLatestAddress(address token)
        external
        view
        override
        returns (address)
    {
        return _redirects[token] == address(0) ? token : _redirects[token];
    }

    /**
     * @dev Returns true if the token is supported.
     */
    function isSupported(address token) public view override returns (bool) {
        return _supported[token];
    }

    /**
     * @dev Returns true if the token is currently active.
     */
    function isActive(address token) public view override returns (bool) {
        return !_paused[token] && isSupported(token);
    }
}
