// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TIPLToken.sol";

contract TokenFactory {
    address[] public deployedTokens;

    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        address indexed recipient
    );

    function createToken(
        string memory name,
        string memory symbol,
        address recipient
    ) external returns (address) {
        require(recipient != address(0), "Recipient cannot be zero address");

        TIPLToken token = new TIPLToken(recipient, symbol, name);
        address tokenAddress = address(token);

        deployedTokens.push(tokenAddress);

        emit TokenCreated(tokenAddress, name, symbol, recipient);

        return tokenAddress;
    }

    function getDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }

    function getDeployedTokenCount() external view returns (uint256) {
        return deployedTokens.length;
    }
}
