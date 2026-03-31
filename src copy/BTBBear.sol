// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BTB Bear (BTBB)
 * @notice A 1:1 wrapped token for BTB Finance with 1% tax on transfers
 * @dev Users deposit BTB tokens to mint BTBB tokens (1:1 ratio)
 *      Users can redeem BTBB tokens back to BTB tokens (1:1 ratio)
 *      ALL BTBB transfers incur 1% tax
 *      100% of tax goes to NFT staking contract
 */
contract BTBBear is ERC20, ERC20Burnable, ERC1363, ERC20Permit, Ownable, ReentrancyGuard {
    IERC20 public immutable BTB_TOKEN;

    uint256 public constant TAX_RATE = 100; // 1%
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice NFT Staking contract that receives 100% of transfer fees
    address public bearStaking;

    event Minted(address indexed user, uint256 btbAmount, uint256 btbbAmount);
    event Redeemed(address indexed user, uint256 btbbAmount, uint256 btbAmount);
    event TaxCollected(address indexed from, address indexed to, uint256 amount, uint256 taxAmount);
    event BearStakingUpdated(address indexed oldStaking, address indexed newStaking);
    event FeesWithdrawn(address indexed staking, uint256 amount);

    constructor(address btbToken, address _bearStaking, address initialOwner)
        ERC20("BTB Bear", "BTBB")
        ERC20Permit("BTB Bear")
        Ownable(initialOwner)
    {
        require(btbToken != address(0), "Invalid BTB token");
        // _bearStaking can be zero, set later via setBearStaking()

        BTB_TOKEN = IERC20(btbToken);
        bearStaking = _bearStaking;
    }

    /**
     * @notice Update the staking contract address (only owner)
     */
    function setBearStaking(address newStaking) external onlyOwner {
        require(newStaking != address(0), "Invalid address");
        address oldStaking = bearStaking;
        bearStaking = newStaking;
        emit BearStakingUpdated(oldStaking, newStaking);
    }

    /**
     * @notice Withdraw accumulated fees to staking contract
     * @dev Only the staking contract can call this to pull its fees
     */
    function withdrawFees() external nonReentrant {
        require(msg.sender == bearStaking, "Only staking can withdraw");
        uint256 fees = balanceOf(address(this));
        require(fees > 0, "No fees to withdraw");
        
        _transfer(address(this), bearStaking, fees);
        emit FeesWithdrawn(bearStaking, fees);
    }

    /**
     * @notice Mint BTBB tokens by depositing BTB tokens (1:1 ratio)
     */
    function mint(uint256 btbAmount) external nonReentrant returns (uint256 btbbAmount) {
        require(btbAmount > 0, "Amount must be > 0");

        btbbAmount = btbAmount;

        require(BTB_TOKEN.transferFrom(msg.sender, address(this), btbAmount), "BTB transfer failed");
        _mint(msg.sender, btbbAmount);

        emit Minted(msg.sender, btbAmount, btbbAmount);
    }

    /**
     * @notice Redeem BTBB tokens for BTB tokens (1:1 ratio)
     */
    function redeem(uint256 btbbAmount) external nonReentrant returns (uint256 btbAmount) {
        require(btbbAmount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= btbbAmount, "Insufficient BTBB");

        btbAmount = btbbAmount;

        require(BTB_TOKEN.balanceOf(address(this)) >= btbAmount, "Insufficient BTB");

        _burn(msg.sender, btbbAmount);
        require(BTB_TOKEN.transfer(msg.sender, btbAmount), "BTB transfer failed");

        emit Redeemed(msg.sender, btbbAmount, btbAmount);
    }

    /**
     * @notice Override transfer to apply 1% tax (100% to staking)
     */
    function transfer(address to, uint256 amount) public virtual override(ERC20, IERC20) returns (bool) {
        address sender = _msgSender();

        uint256 taxAmount = (amount * TAX_RATE) / BASIS_POINTS;
        uint256 netAmount = amount - taxAmount;

        if (taxAmount > 0) {
            _transfer(sender, address(this), taxAmount);
        }
        _transfer(sender, to, netAmount);

        emit TaxCollected(sender, to, amount, taxAmount);
        return true;
    }

    /**
     * @notice Override transferFrom to apply 1% tax (100% to staking)
     */
    function transferFrom(address from, address to, uint256 amount)
        public
        virtual
        override(ERC20, IERC20)
        returns (bool)
    {
        _spendAllowance(from, _msgSender(), amount);

        uint256 taxAmount = (amount * TAX_RATE) / BASIS_POINTS;
        uint256 netAmount = amount - taxAmount;

        if (taxAmount > 0) {
            _transfer(from, address(this), taxAmount);
        }
        _transfer(from, to, netAmount);

        emit TaxCollected(from, to, amount, taxAmount);
        return true;
    }

    /**
     * @notice Preview transfer tax
     */
    function previewTransfer(uint256 amount) external pure returns (uint256 netAmount, uint256 taxAmount) {
        taxAmount = (amount * TAX_RATE) / BASIS_POINTS;
        netAmount = amount - taxAmount;
    }

    /**
     * @notice Get pending fees available for staking
     */
    function pendingFees() external view returns (uint256) {
        return balanceOf(address(this));
    }

    /**
     * @notice Get contract stats
     */
    function getStats() external view returns (uint256 btbBalance, uint256 btbbSupply) {
        btbBalance = BTB_TOKEN.balanceOf(address(this));
        btbbSupply = totalSupply();
    }
}