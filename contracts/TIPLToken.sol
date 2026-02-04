// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TIPLToken is ERC20, ERC20Burnable, ERC20Permit {
    constructor(
        address recipient,
        string memory symbol,
        string memory name
    ) ERC20(name, symbol) ERC20Permit(name) {
        _mint(recipient, 1_000_000 * 10 ** decimals());
    }
}
