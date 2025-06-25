// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

/*
██████╗ ████████╗██████╗
██╔══██╗╚══██╔══╝██╔══██╗
██████╔╝   ██║   ██████╔╝
██╔══██╗   ██║   ██╔══██╗
██████╔╝   ██║   ██████╔╝
╚═════╝    ╚═╝   ╚═════╝
███████╗██╗███╗   ██╗ █████╗ ███╗   ██╗ ██████╗███████╗
██╔════╝██║████╗  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝
█████╗  ██║██╔██╗ ██║███████║██╔██╗ ██║██║     █████╗  
██╔══╝  ██║██║╚██╗██║██╔══██║██║╚██╗██║██║     ██╔══╝  
██║     ██║██║ ╚████║██║  ██║██║ ╚████║╚██████╗███████╗
╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
*/

import {ERC1363} from "erc1363-payable-token/contracts/token/ERC1363/ERC1363.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @custom:security-contact hello@btb.finance
contract BTBFinance is ERC20, ERC1363, ERC20Permit {
    constructor(address recipient)
        ERC20("BTB Finance", "BTB")
        ERC20Permit("BTB Finance")
    {
        _mint(recipient, 88888888888 * 10 ** decimals());
    }
}