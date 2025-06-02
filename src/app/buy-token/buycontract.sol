// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// BTBUSDCSwap 
// Swap contract with fixes for precision loss and liquidity protection
// Implements minimum amounts, reserve requirements, and better error handling
contract BTBUSDCSwapSecure is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable USDC;
    IERC20 public immutable BTB;
    
    address public taxRecipient;
    
    // Whitelist mapping
    mapping(address => bool) public whitelist;
    
    // Constants for decimals
    uint256 private constant USDC_DECIMALS = 6;
    uint256 private constant BTB_DECIMALS = 18;
    
    // Swap rate: 1 USDC = 1000 BTB
    uint256 private constant RATE_MULTIPLIER = 1000;
    uint256 private constant TAX_PERCENTAGE = 5; // 5%
    uint256 private constant MAX_TAX_PERCENTAGE = 10; // Maximum allowed tax
    
    // Security constants
    uint256 private constant MIN_USDC_TRADE = 100; // 0.0001 USDC minimum (100 units)
    uint256 private constant MIN_BTB_TRADE = 100_000 * 1e12; // 0.1 BTB minimum
    uint256 private constant MAX_TRADE_SIZE = 1_000_000 * 1e6; // 1M USDC max per trade
    uint256 private constant RESERVE_RATIO = 10; // Keep 10% as reserve
    
    // Events
    event Swap(
        address indexed user, 
        bool indexed isBuy, 
        uint256 amountIn, 
        uint256 amountOut, 
        uint256 tax
    );
    event WhitelistUpdated(address indexed account, bool status);
    event TaxRecipientUpdated(address indexed newRecipient);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event ReservesLow(address indexed token, uint256 balance, uint256 required);
    
    constructor(
        address _usdc, 
        address _btb, 
        address _taxRecipient
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_btb != address(0), "Invalid BTB address");
        require(_taxRecipient != address(0), "Invalid tax recipient");
        
        USDC = IERC20(_usdc);
        BTB = IERC20(_btb);
        taxRecipient = _taxRecipient;
        
        // Verify decimals
        require(
            IERC20Metadata(_usdc).decimals() == USDC_DECIMALS, 
            "Invalid USDC decimals"
        );
        require(
            IERC20Metadata(_btb).decimals() == BTB_DECIMALS, 
            "Invalid BTB decimals"
        );
    }
    
    // Buy BTB with USDC
    // usdcAmount: Amount of USDC to swap
    function buyBTB(uint256 usdcAmount) external nonReentrant whenNotPaused {
        require(usdcAmount >= MIN_USDC_TRADE, "Amount below minimum");
        require(usdcAmount <= MAX_TRADE_SIZE, "Amount above maximum");
        
        // Calculate BTB amount with overflow protection
        uint256 btbAmount = _calculateBTBAmount(usdcAmount);
        
        uint256 taxAmount = 0;
        uint256 btbToUser = btbAmount;
        
        // Apply tax if not whitelisted
        if (!whitelist[msg.sender]) {
            taxAmount = _calculateTax(btbAmount);
            btbToUser = btbAmount - taxAmount;
        }
        
        // Check contract BTB balance and reserves
        uint256 btbBalance = BTB.balanceOf(address(this));
        require(btbBalance >= btbAmount, "Insufficient BTB in contract");
        
        // Check reserve requirement
        uint256 reserveRequired = (btbBalance * RESERVE_RATIO) / 100;
        if (btbBalance - btbAmount < reserveRequired) {
            emit ReservesLow(address(BTB), btbBalance - btbAmount, reserveRequired);
            revert("Would breach reserve requirement");
        }
        
        // Transfer USDC from user to contract
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // Transfer BTB to user
        BTB.safeTransfer(msg.sender, btbToUser);
        
        // Transfer tax to tax recipient if applicable
        if (taxAmount > 0) {
            BTB.safeTransfer(taxRecipient, taxAmount);
        }
        
        emit Swap(msg.sender, true, usdcAmount, btbToUser, taxAmount);
    }
    
    // Buy BTB with USDC on behalf of buyer (for bot usage)
    // buyer: Address of the buyer
    // usdcAmount: Amount of USDC to swap
    function buyBTBFor(address buyer, uint256 usdcAmount) external nonReentrant whenNotPaused {
        require(buyer != address(0), "Invalid buyer address");
        require(usdcAmount >= MIN_USDC_TRADE, "Amount below minimum");
        require(usdcAmount <= MAX_TRADE_SIZE, "Amount above maximum");
        
        // Calculate BTB amount with overflow protection
        uint256 btbAmount = _calculateBTBAmount(usdcAmount);
        
        uint256 taxAmount = 0;
        uint256 btbToUser = btbAmount;
        
        // Apply tax if buyer is not whitelisted
        if (!whitelist[buyer]) {
            taxAmount = _calculateTax(btbAmount);
            btbToUser = btbAmount - taxAmount;
        }
        
        // Check contract BTB balance and reserves
        uint256 btbBalance = BTB.balanceOf(address(this));
        require(btbBalance >= btbAmount, "Insufficient BTB in contract");
        
        // Check reserve requirement
        uint256 reserveRequired = (btbBalance * RESERVE_RATIO) / 100;
        if (btbBalance - btbAmount < reserveRequired) {
            emit ReservesLow(address(BTB), btbBalance - btbAmount, reserveRequired);
            revert("Would breach reserve requirement");
        }
        
        // Transfer USDC from buyer to contract
        USDC.safeTransferFrom(buyer, address(this), usdcAmount);
        
        // Transfer BTB to buyer
        BTB.safeTransfer(buyer, btbToUser);
        
        // Transfer tax to tax recipient if applicable
        if (taxAmount > 0) {
            BTB.safeTransfer(taxRecipient, taxAmount);
        }
        
        emit Swap(buyer, true, usdcAmount, btbToUser, taxAmount);
    }
    
    // Sell BTB for USDC
    // btbAmount: Amount of BTB to swap
    function sellBTB(uint256 btbAmount) external nonReentrant whenNotPaused {
        require(btbAmount >= MIN_BTB_TRADE, "Amount below minimum");
        
        // Calculate USDC amount
        uint256 usdcAmount = btbAmount / (RATE_MULTIPLIER * (10 ** (BTB_DECIMALS - USDC_DECIMALS)));
        require(usdcAmount > 0, "BTB amount too small");
        require(usdcAmount >= MIN_USDC_TRADE, "Resulting USDC below minimum");
        
        uint256 taxAmount = 0;
        uint256 usdcToUser = usdcAmount;
        
        // Apply tax if not whitelisted
        if (!whitelist[msg.sender]) {
            taxAmount = _calculateTaxUSDC(usdcAmount);
            usdcToUser = usdcAmount - taxAmount;
            require(usdcToUser > 0, "Amount too small after tax");
        }
        
        // Check contract USDC balance and reserves
        uint256 usdcBalance = USDC.balanceOf(address(this));
        require(usdcBalance >= usdcAmount, "Insufficient USDC in contract");
        
        // Check reserve requirement
        uint256 reserveRequired = (usdcBalance * RESERVE_RATIO) / 100;
        if (usdcBalance - usdcAmount < reserveRequired) {
            emit ReservesLow(address(USDC), usdcBalance - usdcAmount, reserveRequired);
            revert("Would breach reserve requirement");
        }
        
        // Transfer BTB from user to contract
        BTB.safeTransferFrom(msg.sender, address(this), btbAmount);
        
        // Transfer USDC to user
        USDC.safeTransfer(msg.sender, usdcToUser);
        
        // Transfer tax to tax recipient if applicable
        if (taxAmount > 0) {
            USDC.safeTransfer(taxRecipient, taxAmount);
        }
        
        emit Swap(msg.sender, false, btbAmount, usdcToUser, taxAmount);
    }
    
    // Sell BTB for USDC on behalf of seller (for bot usage)
    // seller: Address of the seller
    // btbAmount: Amount of BTB to swap
    function sellBTBFor(address seller, uint256 btbAmount) external nonReentrant whenNotPaused {
        require(seller != address(0), "Invalid seller address");
        require(btbAmount >= MIN_BTB_TRADE, "Amount below minimum");
        
        // Calculate USDC amount
        uint256 usdcAmount = btbAmount / (RATE_MULTIPLIER * (10 ** (BTB_DECIMALS - USDC_DECIMALS)));
        require(usdcAmount > 0, "BTB amount too small");
        require(usdcAmount >= MIN_USDC_TRADE, "Resulting USDC below minimum");
        
        uint256 taxAmount = 0;
        uint256 usdcToUser = usdcAmount;
        
        // Apply tax if seller is not whitelisted
        if (!whitelist[seller]) {
            taxAmount = _calculateTaxUSDC(usdcAmount);
            usdcToUser = usdcAmount - taxAmount;
            require(usdcToUser > 0, "Amount too small after tax");
        }
        
        // Check contract USDC balance and reserves
        uint256 usdcBalance = USDC.balanceOf(address(this));
        require(usdcBalance >= usdcAmount, "Insufficient USDC in contract");
        
        // Check reserve requirement
        uint256 reserveRequired = (usdcBalance * RESERVE_RATIO) / 100;
        if (usdcBalance - usdcAmount < reserveRequired) {
            emit ReservesLow(address(USDC), usdcBalance - usdcAmount, reserveRequired);
            revert("Would breach reserve requirement");
        }
        
        // Transfer BTB from seller to contract
        BTB.safeTransferFrom(seller, address(this), btbAmount);
        
        // Transfer USDC to seller
        USDC.safeTransfer(seller, usdcToUser);
        
        // Transfer tax to tax recipient if applicable
        if (taxAmount > 0) {
            USDC.safeTransfer(taxRecipient, taxAmount);
        }
        
        emit Swap(seller, false, btbAmount, usdcToUser, taxAmount);
    }
    
    // Calculate BTB amount for given USDC with overflow protection
    function _calculateBTBAmount(uint256 usdcAmount) private pure returns (uint256) {
        // Check for overflow
        require(usdcAmount <= type(uint256).max / RATE_MULTIPLIER / (10 ** (BTB_DECIMALS - USDC_DECIMALS)), 
                "Calculation would overflow");
        return usdcAmount * RATE_MULTIPLIER * (10 ** (BTB_DECIMALS - USDC_DECIMALS));
    }
    
    // Calculate tax with minimum amount for BTB
    function _calculateTax(uint256 amount) private pure returns (uint256) {
        uint256 tax = (amount * TAX_PERCENTAGE) / 100;
        // Minimum tax of 1000 * 1e12 BTB (0.001 BTB)
        uint256 minTax = 1000 * 1e12;
        return tax > minTax ? tax : minTax;
    }
    
    // Calculate tax with minimum amount for USDC
    function _calculateTaxUSDC(uint256 amount) private pure returns (uint256) {
        uint256 tax = (amount * TAX_PERCENTAGE) / 100;
        // Minimum tax of 1 USDC unit
        return tax > 0 ? tax : 1;
    }
    
    // Calculate how much BTB user will receive for given USDC amount
    function calculateBTBOut(
        uint256 usdcAmount, 
        address user
    ) external view returns (uint256 btbOut, uint256 tax) {
        if (usdcAmount < MIN_USDC_TRADE) return (0, 0);
        
        uint256 btbAmount = _calculateBTBAmount(usdcAmount);
        
        if (!whitelist[user]) {
            tax = _calculateTax(btbAmount);
            btbOut = btbAmount - tax;
        } else {
            btbOut = btbAmount;
            tax = 0;
        }
    }
    
    // Calculate how much USDC user will receive for given BTB amount
    function calculateUSDCOut(
        uint256 btbAmount, 
        address user
    ) external view returns (uint256 usdcOut, uint256 tax) {
        if (btbAmount < MIN_BTB_TRADE) return (0, 0);
        
        uint256 usdcAmount = btbAmount / (RATE_MULTIPLIER * (10 ** (BTB_DECIMALS - USDC_DECIMALS)));
        
        if (!whitelist[user]) {
            tax = _calculateTaxUSDC(usdcAmount);
            usdcOut = usdcAmount > tax ? usdcAmount - tax : 0;
        } else {
            usdcOut = usdcAmount;
            tax = 0;
        }
    }
    
    // Add or remove address from whitelist
    function setWhitelist(address account, bool status) external onlyOwner {
        require(account != address(0), "Invalid address");
        whitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }
    
    // Batch update whitelist
    function setWhitelistBatch(
        address[] calldata accounts, 
        bool status
    ) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Invalid address");
            whitelist[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }
    
    // Update tax recipient address
    function setTaxRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        taxRecipient = newRecipient;
        emit TaxRecipientUpdated(newRecipient);
    }
    
    // Pause contract (emergency use)
    function pause() external onlyOwner {
        _pause();
    }
    
    // Unpause contract
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Emergency withdraw function
    function emergencyWithdraw(
        address token, 
        uint256 amount
    ) external onlyOwner {
        require(
            token == address(USDC) || token == address(BTB), 
            "Invalid token"
        );
        
        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
    
    // Get contract balances
    function getContractBalances() external view returns (
        uint256 usdcBalance, 
        uint256 btbBalance
    ) {
        usdcBalance = USDC.balanceOf(address(this));
        btbBalance = BTB.balanceOf(address(this));
    }
    
    // Check if address is whitelisted
    function isWhitelisted(address account) external view returns (bool) {
        return whitelist[account];
    }
    
    // Get reserve requirements
    function getReserveRequirements() external view returns (
        uint256 usdcReserve,
        uint256 btbReserve
    ) {
        usdcReserve = (USDC.balanceOf(address(this)) * RESERVE_RATIO) / 100;
        btbReserve = (BTB.balanceOf(address(this)) * RESERVE_RATIO) / 100;
    }
    
    // Check if trade is within limits
    function isValidTradeAmount(uint256 usdcAmount, uint256 btbAmount) external pure returns (bool) {
        return usdcAmount >= MIN_USDC_TRADE && 
               usdcAmount <= MAX_TRADE_SIZE &&
               btbAmount >= MIN_BTB_TRADE;
    }
}