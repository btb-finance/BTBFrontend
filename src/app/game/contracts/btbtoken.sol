// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract BTBFinance is ERC20, ERC20Permit {
    constructor(address recipient)
        ERC20("BTB Finance ", "BTB")
        ERC20Permit("BTB Finance ")
    {
        _mint(recipient, 1000000000 * 10 ** decimals());
    }
}