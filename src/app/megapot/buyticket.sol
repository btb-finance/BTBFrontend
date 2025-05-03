// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

// Interface for the BaseJackpot contract - must be defined at file level, not inside another contract
interface IBaseJackpot {
    function purchaseTickets(address referrer, uint256 value, address recipient) external;
    function ticketPrice() external view returns (uint256);
}

/**
 * @title JackpotCashback
 * @dev A contract that purchases tickets from BaseJackpot on behalf of users
 * and provides immediate cashback to incentivize usage
 */
contract JackpotCashback is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // State variables
    IBaseJackpot public jackpotContract;
    IERC20 public token;
    address public referrer;
    uint256 public cashbackPercentage; // in basis points (e.g., 200 = 2%)
    uint256 public constant MAX_CASHBACK_PERCENTAGE = 1000; // 10% maximum cashback

    // Events
    event TicketPurchased(address indexed user, uint256 amount, uint256 cashbackAmount);
    event ReferrerUpdated(address indexed newReferrer);
    event CashbackPercentageUpdated(uint256 newPercentage);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event FundsDeposited(address indexed from, uint256 amount);


    /**
     * @dev Constructor sets initial contract parameters
     * @param _jackpotContract Address of the BaseJackpot contract
     * @param _token Address of the USDC or other ERC20 token used
     * @param _referrer Address to receive referral fees
     * @param _cashbackPercentage Initial cashback percentage in basis points
     */
    constructor(
        address _jackpotContract,
        address _token,
        address _referrer,
        uint256 _cashbackPercentage
    ) Ownable(msg.sender) {
        require(_jackpotContract != address(0), "Invalid jackpot contract address");
        require(_token != address(0), "Invalid token address");
        require(_referrer != address(0), "Invalid referrer address");
        require(_cashbackPercentage <= MAX_CASHBACK_PERCENTAGE, "Cashback percentage too high");
        
        jackpotContract = IBaseJackpot(_jackpotContract);
        token = IERC20(_token);
        referrer = _referrer;
        cashbackPercentage = _cashbackPercentage;
    }

    /**
     * @dev Allows users to purchase tickets with automatic cashback
     * @param amount Amount of tokens to spend on tickets
     */
    function purchaseTicketsWithCashback(uint256 amount) external nonReentrant whenNotPaused {
        uint256 ticketCost = jackpotContract.ticketPrice();
        require(amount >= ticketCost, "Amount below ticket price");
        
        // Calculate cashback amount
        uint256 cashbackAmount = (amount * cashbackPercentage) / 10000;
        
        // Ensure contract has enough tokens to provide cashback
        require(token.balanceOf(address(this)) >= cashbackAmount, "Insufficient cashback funds");
        
        // Transfer tokens from user to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve jackpot contract to spend tokens
        token.approve(address(jackpotContract), amount);
        
        // Purchase tickets on behalf of the user
        jackpotContract.purchaseTickets(referrer, amount, msg.sender);
        
        // Send cashback to user
        if (cashbackAmount > 0) {
            token.safeTransfer(msg.sender, cashbackAmount);
        }
        
        emit TicketPurchased(msg.sender, amount, cashbackAmount);
    }

    /**
     * @dev Updates the referrer address
     * @param _newReferrer New referrer address
     */
    function setReferrer(address _newReferrer) external onlyOwner {
        require(_newReferrer != address(0), "Invalid referrer address");
        referrer = _newReferrer;
        emit ReferrerUpdated(_newReferrer);
    }

    /**
     * @dev Updates the cashback percentage
     * @param _newPercentage New cashback percentage in basis points
     */
    function setCashbackPercentage(uint256 _newPercentage) external onlyOwner {
        require(_newPercentage <= MAX_CASHBACK_PERCENTAGE, "Cashback percentage too high");
        cashbackPercentage = _newPercentage;
        emit CashbackPercentageUpdated(_newPercentage);
    }

    /**
     * @dev Deposits tokens into the contract to fund cashbacks
     * @param amount Amount of tokens to deposit
     */
    function fundCashback(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @dev Withdraws tokens from the contract (for owners to collect fees)
     * @param amount Amount of tokens to withdraw
     */
    function withdrawFunds(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(token.balanceOf(address(this)) >= amount, "Insufficient funds");
        token.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Emergency function to withdraw all tokens from the contract
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");
        token.safeTransfer(msg.sender, balance);
        emit FundsWithdrawn(msg.sender, balance);
    }

    /**
     * @dev Pauses contract functions
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses contract functions
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}