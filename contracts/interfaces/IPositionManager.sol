// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPositionManager {
    function modifyLiquidities(
        bytes calldata unlockData,
        uint256 deadline
    ) external payable;
}
