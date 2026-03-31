// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.28;

import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title BTB Finance Token
/// @author BTB Finance Team
/// @notice Official BTB Finance ERC20 token with ERC1363 and ERC20Permit extensions
/// @custom:security-contact hello@btb.finance
/// @custom:website https://www.btb.finance
/// @custom:twitter https://x.com/BTB_Finance
/// @custom:telegram https://t.me/BTBFinance
/// @custom:farcaster https://farcaster.xyz/btbfinance
contract BTBFinance is ERC20, ERC1363, ERC20Permit {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                         ON-CHAIN METADATA
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Official website
    string public constant WEBSITE = "https://www.btb.finance";
    
    /// @notice Official X (Twitter) account
    string public constant TWITTER = "https://x.com/BTB_Finance";
    
    /// @notice Official Telegram group
    string public constant TELEGRAM = "https://t.me/BTBFinance";
    
    /// @notice Official Farcaster account
    string public constant FARCASTER = "https://farcaster.xyz/btbfinance";
    
    /// @notice Security contact email
    string public constant SECURITY_CONTACT = "hello@btb.finance";
    
    /// @notice Project description
    string public constant DESCRIPTION = "BTB Finance - DeFi Innovation";

    // ═══════════════════════════════════════════════════════════════════════

    constructor(address recipient)
        ERC20("BTB Finance", "BTB")
        ERC20Permit("BTB Finance")
    {
        _mint(recipient, 1000000000 * 10 ** decimals());
    }
}