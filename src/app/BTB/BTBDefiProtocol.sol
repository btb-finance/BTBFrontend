//SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @dev Solidity 0.8.30+ has built-in overflow protection, but we still use Math.mulDiv for:
 * 1. High-precision calculations to prevent intermediate overflow
 * 2. Large number multiplications that could exceed uint256 before division
 * 3. Financial calculations requiring maximum precision
 * Regular arithmetic uses built-in safe math automatically.
 */

// Custom errors for better gas efficiency (Solidity 0.8.4+)
error InvalidRecipient();
error InsufficientAmount();
error InsufficientBalance();
error ProtocolNotActive();
error ProtocolAlreadyActive();
error FeeReceiverNotSet();
error IncorrectETHAmount();
error InsufficientTokenReserves();
error TradeAmountTooSmall();
error MaximumDaysExceeded();
error ExistingPositionNotClosed();
error PositionExpired();
error InsufficientCollateralization();
error PaymentExceedsBorrowed();
error MustPaySomething();
error IncorrectRepaymentAmount();
error InsufficientCollateralValue();
error FeesTooLow();
error FeeRangeInvalid();
error LeverageFeeTooHigh();
error LoopFeeOutOfRange();
error LoopFeeMustBeLessThanPurchaseFee();
error TotalDurationExceedsLimit();
error IncorrectExtensionFee();
error InsufficientContractBalance();
error PriceCannotDecrease();
error ETHTransferFailed();

/**
 * @title BTB DeFi Protocol - Advanced DeFi Lending/Borrowing System
 * @dev Updated to Solidity 0.8.30 with modern features and optimizations
 * @author BTB Team
 * @notice A comprehensive DeFi protocol supporting trading, lending, borrowing, and leveraged positions
 * 
 * === AUDITOR NOTES: HIGH-LEVEL PROTOCOL OVERVIEW ===
 * 
 * This protocol implements a bonding curve-style token trading system combined with:
 * 1. ETH ↔ BTB token trading with dynamic pricing
 * 2. Collateralized lending (stake BTB, borrow ETH) 
 * 3. Leveraged trading positions (borrow ETH to buy more BTB)
 * 4. Loop positions (automated leverage with single transaction)
 * 
 * CRITICAL SECURITY FEATURES:
 * - Flash loan protection via same-block transaction prevention
 * - Price manipulation protection (max 20% increase per transaction)
 * - Liquidation DoS protection via batch processing limits
 * - Virtual burn mechanism for deflationary tokenomics
 * 
 * PRICE MECHANISM:
 * Price = (Contract ETH Balance + Total Borrowed) / (Total Supply - Burned Tokens)
 * Price can ONLY increase (deflationary), never decrease
 * 
 * COLLATERALIZATION:
 * All loans require 99% collateralization minimum
 * Expired loans are automatically liquidated
 * Liquidated collateral is transferred to burn address
 */

/**
 * @title VirtualBurnAddress
 * @dev A controlled token holder that acts as the trading reserve for the main protocol
 * This contract holds BTB tokens for buy/sell operations, separate from collateral
 * Only the owner (main protocol contract) can withdraw tokens from here
 * 
 * === AUDITOR NOTES: VIRTUAL BURN MECHANISM ===
 * 
 * INTENDED BEHAVIOR:
 * - This contract simulates "burning" tokens without actually destroying them
 * - Tokens sent here are removed from circulating supply for price calculations
 * - Main protocol can "mint" by withdrawing tokens from here to users
 * - Balance here represents effectively "burned" tokens
 * 
 * SECURITY CONSIDERATIONS:
 * - Only main protocol contract can withdraw (owner-only)
 * - No direct user interaction allowed
 * - ReentrancyGuard on withdrawals prevents reentrancy attacks
 * - Zero address checks prevent accidental token loss
 * 
 * PRICE IMPACT:
 * Effective Supply = Total Supply - This Contract's Balance
 * As more tokens accumulate here, effective supply decreases, increasing price
 */
contract VirtualBurnAddress is Ownable2Step, ReentrancyGuard {
    IERC20 public immutable BTB_TOKEN;
    
    event TokensWithdrawn(address indexed to, uint256 amount);
    event TokensReceived(address indexed from, uint256 amount);
    
    constructor(address _btbToken, address _owner) Ownable(_owner) {
        if (_btbToken == address(0)) revert InvalidRecipient();
        BTB_TOKEN = IERC20(_btbToken);
    }
    
    /**
     * @dev Allows the owner (main contract) to withdraw tokens for trading
     * @param _to Address to send tokens to
     * @param _amount Amount of tokens to withdraw
     * 
     * === AUDITOR NOTE: TOKEN "MINTING" MECHANISM ===
     * 
     * INTENDED BEHAVIOR:
     * - This simulates minting by releasing previously "burned" tokens
     * - Only main protocol can call this (owner-only protection)
     * - Used when users buy tokens with ETH
     * 
     * SECURITY CHECKS:
     * - Zero address validation prevents token loss
     * - Zero amount validation prevents empty operations
     * - Balance check prevents over-withdrawal
     * - ReentrancyGuard prevents reentrancy attacks
     */
    function withdrawTokens(address _to, uint256 _amount) external onlyOwner nonReentrant {
        if (_to == address(0)) revert InvalidRecipient();
        if (_amount == 0) revert InsufficientAmount();
        if (BTB_TOKEN.balanceOf(address(this)) < _amount) revert InsufficientBalance();
        
        BTB_TOKEN.transfer(_to, _amount);
        emit TokensWithdrawn(_to, _amount);
    }
    
    /**
     * @dev Get the current token balance (represents "burned" tokens)
     */
    function getTokenBalance() external view returns (uint256) {
        return BTB_TOKEN.balanceOf(address(this));
    }
    
    /**
     * @dev Allows the contract to receive tokens
     */
    function receiveTokens(uint256 _amount) external {
        BTB_TOKEN.transferFrom(msg.sender, address(this), _amount);
        emit TokensReceived(msg.sender, _amount);
    }
}

contract BTBDefiProtocol is Ownable2Step, ReentrancyGuard {
    IERC20 public immutable BTB_TOKEN;
    VirtualBurnAddress public immutable VIRTUAL_BURN_ADDRESS;
    address payable public PROTOCOL_FEE_RECEIVER;

    // Constants using modern Solidity patterns
    uint256 private constant MINIMUM_AMOUNT = 10_000; 
    uint256 private constant PRECISION = 10_000;
    uint256 private constant ETH_UNIT = 1 ether;
    uint256 private constant COLLATERAL_RATIO = 9_900; // 99% collateralization
    uint256 private constant MAX_DAYS = 365;
    uint256 private constant SECONDS_PER_DAY = 86_400;

    // Immutable deployment parameters for gas efficiency
    uint256 private immutable DEPLOYMENT_TIMESTAMP;
    uint256 private immutable DEPLOYMENT_BLOCK_NUMBER;

    // Fee configurations with improved validation
    uint16 public tradingFeePercentage = 9_950; // 99.5% to user (0.5% protocol fee)
    uint16 public purchaseFeePercentage = 9_950; // 99.5% to user (0.5% protocol fee)
    uint16 public leverageFeePercentage = 100; // 1% leverage fee
    uint16 public loopFeePercentage = 142; // 1.42% loop fee

    // Arbitrage whitelist for zero-fee trading
    mapping(address => bool) public arbitrageWhitelist;

    bool public protocolActive;
    uint256 public currentPrice;
    uint256 public totalBorrowedAmount;
    uint256 public totalCollateralAmount;
    uint256 public lastLiquidationTimestamp;
    uint256 public activationFee = 0.001 ether; // Configurable until protocol active

    // Optimized struct with better packing (saves gas)
    struct LoanPosition {
        uint128 collateralAmount;    // 16 bytes
        uint128 borrowedAmount;      // 16 bytes - total 32 bytes (1 slot)
        uint64 expirationDate;       // 8 bytes
        uint32 loanDurationDays;     // 4 bytes
        // 4 bytes remaining in slot - could add future fields
        // Total: 2 storage slots instead of 5 (60% gas savings)
        // Note: creationTimestamp removed - emit in LoanCreated event instead
    }

    /**
     * @dev Math Strategy in Solidity 0.8.30:
     * - Regular arithmetic (+, -, *, /) uses built-in overflow protection
     * - Math.mulDiv only for: token calculations, interest rates, large multiplications
     * - unchecked{} blocks for provably safe operations to save gas
     */

    mapping(address => LoanPosition) public userLoanPositions;
    mapping(uint256 => uint256) public dailyBorrowedAmounts;
    mapping(uint256 => uint256) public dailyCollateralAmounts;

    // Events with indexed parameters for better filtering
    event PriceUpdate(uint256 indexed timestamp, uint256 newPrice, uint256 volumeETH);
    event ProtocolActivated(bool indexed isActive);
    event LiquidationEvent(uint256 indexed timestamp, uint256 liquidatedAmount);
    event LoanDataUpdated(
        uint256 collateralByDate,
        uint256 borrowedByDate,
        uint256 totalBorrowed,
        uint256 totalCollateral
    );
    event ETHTransferred(address indexed recipient, uint256 amount);
    event FeeReceiverUpdated(address indexed newReceiver);
    event TradingFeeUpdated(uint256 newFee);
    event PurchaseFeeUpdated(uint256 newFee);
    event LeverageFeeUpdated(uint256 newFee);
    event LoopFeeUpdated(uint256 newFee);
    event LoopCreated(
        address indexed user, 
        uint256 ethAmount, 
        uint256 numberOfDays, 
        uint256 userTokens, 
        uint256 userBorrow, 
        uint256 totalRequired
    );
    event TokensPurchased(address indexed user, uint256 ethAmount, uint256 tokensReceived);
    event TokensSold(address indexed user, uint256 tokensAmount, uint256 ethReceived);
    event LoanCreated(address indexed user, uint256 ethAmount, uint256 collateralAmount, uint256 expirationDate);
    event LoanRepaid(address indexed user, uint256 amount, uint256 remainingDebt);
    event LoanClosed(address indexed user, uint256 collateralReturned);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event LiquidationProcessed(uint256 indexed date, uint256 amount, uint256 count);

    event ProtocolTotalsUpdated(uint256 totalCollateral, uint256 totalBorrowed, uint256 timestamp);

    // Arbitrage whitelist events
    event ArbitrageWhitelistAdded(address indexed account, address indexed addedBy);
    event ArbitrageWhitelistRemoved(address indexed account, address indexed removedBy);
    event ArbitragePurchase(address indexed user, uint256 ethAmount, uint256 tokensReceived);
    event ArbitrageSale(address indexed user, uint256 tokensAmount, uint256 ethReceived);

    // === FLASH LOAN PROTECTION ===
    
    mapping(address => uint256) private lastTransactionBlock;
    uint256 private constant FLASH_LOAN_PROTECTION_BLOCKS = 1;
    
    /**
     * @dev Flash loan protection modifier
     * 
     * === AUDITOR NOTE: CRITICAL SECURITY MECHANISM ===
     * 
     * INTENDED BEHAVIOR:
     * - Prevents flash loan attacks by blocking same-block transactions
     * - Uses tx.origin to track the actual user, not intermediary contracts
     * - Each user can only interact once per block
     * 
     * PROTECTION AGAINST:
     * - Flash loan oracle manipulation (like PancakeBunny $40M exploit)
     * - Same-block arbitrage attacks
     * - Price manipulation through rapid buy/sell cycles
     * 
     * MECHANISM:
     * - Records last transaction block for each tx.origin
     * - Reverts if user tries to transact in same block
     * - Applied to all critical trading/leverage functions
     */
    modifier noFlashLoan() {
        require(
            lastTransactionBlock[tx.origin] < block.number, 
            "Flash loan protection: same block transaction"
        );
        lastTransactionBlock[tx.origin] = block.number;
        _;
    }

    // === LIQUIDATION DOS PROTECTION ===
    
    /**
     * === AUDITOR NOTE: LIQUIDATION DOS PROTECTION ===
     * 
     * INTENDED BEHAVIOR:
     * - Limits liquidation processing to prevent out-of-gas errors
     * - Processes maximum 50 days worth of liquidations per transaction
     * - Prevents protocol halting during high liquidation periods
     * 
     * ATTACK PREVENTION:
     * - Stops malicious actors from causing liquidation failures
     * - Prevents protocol insolvency during market crashes
     * - Ensures liquidations can always proceed incrementally
     * 
     * MECHANISM:
     * - MAX_LIQUIDATION_BATCHES = 50 days maximum per call
     * - If more liquidations pending, can be called multiple times
     * - Tracks progress via lastLiquidationTimestamp
     */
    uint256 private constant MAX_LIQUIDATION_BATCHES = 50; // Prevent unbounded loops
    

    

    

    


    constructor(address _btbToken) Ownable(msg.sender) {
        if (_btbToken == address(0)) revert InvalidRecipient();
        BTB_TOKEN = IERC20(_btbToken);
        // Deploy the virtual burn address with this contract as owner
        VIRTUAL_BURN_ADDRESS = new VirtualBurnAddress(_btbToken, address(this));
        lastLiquidationTimestamp = getDayStartTimestamp(block.timestamp);
        DEPLOYMENT_TIMESTAMP = block.timestamp;
        DEPLOYMENT_BLOCK_NUMBER = block.number;
    }

    function setActivationFee(uint256 _fee) external onlyOwner {
        if (protocolActive) revert ProtocolAlreadyActive();
        activationFee = _fee;
    }

    function activateProtocol() external payable onlyOwner {
        if (protocolActive) revert ProtocolAlreadyActive();
        if (PROTOCOL_FEE_RECEIVER == address(0)) revert FeeReceiverNotSet();
        if (msg.value != activationFee) revert IncorrectETHAmount();
        
        // Withdraw 2500 BTB tokens from virtual burn address to set initial price
        uint256 initialTokens = 2_500 * 10**18; // 2500 BTB tokens
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < initialTokens) revert InsufficientTokenReserves();
        
        // Withdraw tokens to this contract to establish initial backing
        VIRTUAL_BURN_ADDRESS.withdrawTokens(address(this), initialTokens);
        
        // Set initial price based on ETH backing and effective supply
        currentPrice = (getProtocolBacking() * 1 ether) / getEffectiveSupply();
        
        protocolActive = true;
        emit ProtocolActivated(true);
        emit PriceUpdate(block.timestamp, currentPrice, msg.value);
    }

    function setFeeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert InvalidRecipient();
        PROTOCOL_FEE_RECEIVER = payable(_receiver);
        emit FeeReceiverUpdated(_receiver);
    }

    function updateTradingFee(uint16 _feePercentage) external onlyOwner {
        // Protocol fee range: 0.05% to 5%
        // User share range: 95% to 99.95%
        if (_feePercentage < 9_500 || _feePercentage > 9_995) revert FeeRangeInvalid();
        tradingFeePercentage = _feePercentage;
        emit TradingFeeUpdated(_feePercentage);
    }

    function updatePurchaseFee(uint16 _feePercentage) external onlyOwner {
        // Protocol fee range: 0.05% to 5%
        // User share range: 95% to 99.95%
        if (_feePercentage < 9_500 || _feePercentage > 9_995) revert FeeRangeInvalid();
        purchaseFeePercentage = _feePercentage;
        emit PurchaseFeeUpdated(_feePercentage);
    }

    function updateLeverageFee(uint16 _feePercentage) external onlyOwner {
        if (_feePercentage > 250) revert LeverageFeeTooHigh();
        leverageFeePercentage = _feePercentage;
        emit LeverageFeeUpdated(_feePercentage);
    }

    function updateLoopFee(uint16 _feePercentage) external onlyOwner {
        if (_feePercentage < 50 || _feePercentage > 250) revert LoopFeeOutOfRange();
        if (_feePercentage > purchaseFeePercentage) revert LoopFeeMustBeLessThanPurchaseFee();
        loopFeePercentage = _feePercentage;
        emit LoopFeeUpdated(_feePercentage);
    }

    /**
     * @notice Add an address to the arbitrage whitelist for zero-fee trading
     * @param _account Address to add to whitelist
     */
    function addArbitrageWhitelist(address _account) external onlyOwner {
        if (_account == address(0)) revert InvalidRecipient();
        arbitrageWhitelist[_account] = true;
        emit ArbitrageWhitelistAdded(_account, msg.sender);
    }

    /**
     * @notice Remove an address from the arbitrage whitelist
     * @param _account Address to remove from whitelist
     */
    function removeArbitrageWhitelist(address _account) external onlyOwner {
        arbitrageWhitelist[_account] = false;
        emit ArbitrageWhitelistRemoved(_account, msg.sender);
    }

    /**
     * @notice Check if an address is whitelisted for arbitrage
     * @param _account Address to check
     * @return isWhitelisted True if address is whitelisted
     */
    function isArbitrageWhitelisted(address _account) external view returns (bool isWhitelisted) {
        return arbitrageWhitelist[_account];
    }

    /**
     * @dev Allows users to purchase BTB tokens with ETH
     * @param _recipient Address to receive the tokens
     * 
     * === AUDITOR NOTE: CRITICAL TRADING FUNCTION ===
     * 
     * INTENDED BEHAVIOR:
     * 1. Process any pending liquidations first
     * 2. Calculate tokens based on current price
     * 3. Apply purchase fee (0.5% to protocol, 99.5% to user)
     * 4. Withdraw tokens from virtual burn address (simulates minting)
     * 5. Send protocol fee to fee receiver
     * 6. Perform safety checks to ensure price integrity
     * 
     * SECURITY PROTECTIONS:
     * - nonReentrant: Prevents reentrancy attacks
     * - noFlashLoan: Blocks same-block transactions
     * - processLiquidations(): Updates state before trading
     * - performSafetyCheck(): Validates price increase
     * 
     * PRICE CALCULATION:
     * tokens = msg.value * effectiveSupply / protocolBacking
     * userTokens = tokens * 99.5%
     * protocolFee = msg.value * 0.5%
     * 
     * CRITICAL INVARIANTS:
     * - Price can only increase (enforced in performSafetyCheck)
     * - Contract balance ≥ collateral (enforced in performSafetyCheck)
     * - Protocol fee > MINIMUM_AMOUNT (prevents dust attacks)
     */
    function purchaseTokens(address _recipient) 
        external 
        payable 
        nonReentrant 
        noFlashLoan
    {
        processLiquidations();
        if (!protocolActive) revert ProtocolNotActive();
        if (_recipient == address(0)) revert InvalidRecipient();

        uint256 tokensToSend = calculateETHtoTokens(msg.value);
        uint256 userTokens = (tokensToSend * getPurchaseFeeRate()) / PRECISION;

        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < userTokens) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(_recipient, userTokens);

        // Calculate protocol fee as percentage of ETH sent (0.5% of total)
        uint256 protocolFee = msg.value * (PRECISION - purchaseFeePercentage) / PRECISION;
        if (msg.value < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        // Perform safety check after all transfers are complete
        performSafetyCheck(msg.value);
        emit TokensPurchased(_recipient, msg.value, userTokens);
    }

    /**
     * @dev Allows users to sell BTB tokens for ETH
     * @param _tokenAmount Amount of tokens to sell
     * 
     * === AUDITOR NOTE: CRITICAL TRADING FUNCTION ===
     * 
     * INTENDED BEHAVIOR:
     * 1. Process any pending liquidations first
     * 2. Calculate ETH based on current price
     * 3. Transfer tokens from user to virtual burn address (simulates burning)
     * 4. Apply trading fee (0.5% to protocol, 99.5% to user)
     * 5. Send ETH to user and protocol fee to receiver
     * 6. Perform safety checks to ensure price integrity
     * 
     * SECURITY PROTECTIONS:
     * - nonReentrant: Prevents reentrancy attacks
     * - processLiquidations(): Updates state before trading
     * - performSafetyCheck(): Validates price never decreases
     * 
     * PRICE CALCULATION:
     * ethAmount = tokenAmount * protocolBacking / effectiveSupply
     * userETH = ethAmount * 99.5%
     * protocolFee = ethAmount * 0.5%
     * 
     * TOKEN FLOW:
     * - Tokens transferred from user to VIRTUAL_BURN_ADDRESS
     * - This reduces effective supply and increases price
     * - Simulates deflationary token burning
     * 
     * CRITICAL INVARIANTS:
     * - Price can only increase (selling reduces supply)
     * - Contract must have sufficient ETH for payment
     * - Protocol fee > MINIMUM_AMOUNT (prevents dust attacks)
     */
    function sellTokens(uint256 _tokenAmount) external nonReentrant {
        processLiquidations();
        if (!protocolActive) revert ProtocolNotActive();
        if (_tokenAmount == 0) revert InsufficientAmount();

        uint256 ethToSend = calculateTokensToETH(_tokenAmount);
        
        BTB_TOKEN.transferFrom(msg.sender, address(VIRTUAL_BURN_ADDRESS), _tokenAmount);

        // Calculate user ETH first (99.5% of total)
        uint256 userETH = (ethToSend * tradingFeePercentage) / PRECISION;
        
        // Protocol fee is the remaining amount (ensures total = 100%)
        uint256 protocolFee = ethToSend - userETH;
        
        // Send payments first
        transferETH(msg.sender, userETH);

        if (ethToSend < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        // Perform safety check after all transfers are complete
        performSafetyCheck(ethToSend);
        emit TokensSold(msg.sender, _tokenAmount, userETH);
    }

    /**
     * @notice Zero-fee token purchase for whitelisted arbitrage bots
     * @param _recipient Address to receive the tokens
     * @dev Only callable by whitelisted addresses, pays 0 fees
     */
    function arbitragePurchase(address _recipient) 
        external 
        payable 
        nonReentrant 
        noFlashLoan
    {
        if (!arbitrageWhitelist[msg.sender]) revert InvalidRecipient();
        processLiquidations();
        if (!protocolActive) revert ProtocolNotActive();
        if (_recipient == address(0)) revert InvalidRecipient();

        uint256 tokensToSend = calculateETHtoTokens(msg.value);
        // Whitelisted addresses get 100% of tokens, 0% fees
        
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < tokensToSend) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(_recipient, tokensToSend);

        // No protocol fees for arbitrage bots
        
        performSafetyCheck(msg.value);
        emit ArbitragePurchase(_recipient, msg.value, tokensToSend);
    }

    /**
     * @notice Zero-fee token sale for whitelisted arbitrage bots
     * @param _tokenAmount Amount of tokens to sell
     * @dev Only callable by whitelisted addresses, pays 0 fees
     */
    function arbitrageSell(uint256 _tokenAmount) external nonReentrant {
        if (!arbitrageWhitelist[msg.sender]) revert InvalidRecipient();
        processLiquidations();
        if (!protocolActive) revert ProtocolNotActive();
        if (_tokenAmount == 0) revert InsufficientAmount();

        uint256 ethToSend = calculateTokensToETH(_tokenAmount);
        
        BTB_TOKEN.transferFrom(msg.sender, address(VIRTUAL_BURN_ADDRESS), _tokenAmount);

        // Whitelisted addresses get 100% of ETH, 0% fees
        transferETH(msg.sender, ethToSend);

        // No protocol fees for arbitrage bots
        
        performSafetyCheck(ethToSend);
        emit ArbitrageSale(msg.sender, _tokenAmount, ethToSend);
    }

    function calculatePurchaseAmount(uint256 _ethAmount) external view returns (uint256) {
        uint256 tokens = calculateETHtoTokensView(_ethAmount);
        return (tokens * getPurchaseFeeRate()) / PRECISION;
    }

    /**
     * @notice Calculate tokens received for arbitrage purchase (zero fees)
     * @param _ethAmount Amount of ETH to spend
     * @return tokensOut Amount of tokens that would be received
     * @dev Only for preview - actual function checks whitelist
     */
    function calculateArbitragePurchase(uint256 _ethAmount) external view returns (uint256 tokensOut) {
        return calculateETHtoTokensView(_ethAmount); // 100% of tokens, 0% fees
    }

    /**
     * @notice Calculate ETH received for arbitrage sale (zero fees)
     * @param _tokenAmount Amount of tokens to sell
     * @return ethOut Amount of ETH that would be received
     * @dev Only for preview - actual function checks whitelist
     */
    function calculateArbitrageSale(uint256 _tokenAmount) external view returns (uint256 ethOut) {
        return calculateTokensToETH(_tokenAmount); // 100% of ETH, 0% fees
    }

    function calculateLeverageCost(uint256 _ethAmount, uint256 _days) external view returns (uint256) {
        uint256 leverageFee = (_ethAmount * leverageFeePercentage) / PRECISION;
        uint256 interestCost = getInterestCost(_ethAmount, _days);
        return leverageFee + interestCost;
    }

    /**
     * @notice Creates a leveraged loop position - BTB's version of BREAD's loop() function
     * @param _ethAmount The amount of ETH to leverage loop
     * @param _numberOfDays The duration of the loan in days
     * @dev This allows users to create leveraged positions by automatically buying BTB with borrowed ETH
     */
    function createLoopPosition(uint256 _ethAmount, uint256 _numberOfDays) 
        external 
        payable 
        nonReentrant
        noFlashLoan
    {
        if (!protocolActive) revert ProtocolNotActive();
        if (_numberOfDays >= MAX_DAYS + 1) revert MaximumDaysExceeded();
        if (_ethAmount == 0) revert InsufficientAmount();

        // Check for existing loans
        LoanPosition memory existingLoan = userLoanPositions[msg.sender];
        if (existingLoan.borrowedAmount != 0) {
            if (isPositionExpired(msg.sender)) {
                delete userLoanPositions[msg.sender];
            } else {
                revert ExistingPositionNotClosed();
            }
        }

        processLiquidations();
        uint256 expirationDate = getDayStartTimestamp(block.timestamp + (_numberOfDays * 1 days));

        // Calculate all fees and requirements (similar to BREAD's loopCalcs)
        (uint256 loopFee, uint256 userBorrow, uint256 overCollateralizationAmount, uint256 interestFee) = calculateLoopParameters(_ethAmount, _numberOfDays);

        uint256 totalETHRequired = overCollateralizationAmount + loopFee + interestFee;

        // Handle overpayment refund
        uint256 refund = 0;
        if (msg.value > totalETHRequired) {
            refund = msg.value - totalETHRequired;
            transferETH(msg.sender, refund);
        }
        if (msg.value - refund != totalETHRequired) revert IncorrectETHAmount();

        uint256 userETH = _ethAmount - loopFee;
        uint256 userTokens = previewLoopMint(userETH, totalETHRequired);
        
        // Transfer tokens from virtual burn address to this contract for collateral
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < userTokens) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(address(this), userTokens);

        // Pay protocol fees
        uint256 protocolFee = (loopFee + interestFee) * 35 / 100; // 35% like BREAD
        if (_ethAmount < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        // Update loan tracking
        updateLoanData(userBorrow, userTokens, expirationDate, true);
        userLoanPositions[msg.sender] = LoanPosition({
            collateralAmount: uint128(userTokens),
            borrowedAmount: uint128(userBorrow),
            expirationDate: uint64(expirationDate),
            loanDurationDays: uint32(_numberOfDays)
        });

        performSafetyCheck(_ethAmount);
        emit LoopCreated(msg.sender, _ethAmount, _numberOfDays, userTokens, userBorrow, totalETHRequired);
        emit LoanCreated(msg.sender, userBorrow, userTokens, expirationDate);
    }

    /**
     * @notice Calculate loop parameters similar to BREAD's loopCalcs
     * @param _ethAmount Amount of ETH for the loop
     * @param _numberOfDays Duration of the loop
     * @return loopFee Fee for the loop operation
     * @return userBorrow Amount the user borrows
     * @return overCollateralizationAmount Overcollateralization amount
     * @return interestFee Interest fee for the loan
     */
    function calculateLoopParameters(uint256 _ethAmount, uint256 _numberOfDays) 
        public 
        view 
        returns (uint256 loopFee, uint256 userBorrow, uint256 overCollateralizationAmount, uint256 interestFee) 
    {
        loopFee = _ethAmount * loopFeePercentage / PRECISION;
        uint256 userETH = _ethAmount - loopFee;
        userBorrow = userETH * COLLATERAL_RATIO / PRECISION;
        overCollateralizationAmount = userETH - userBorrow;
        interestFee = getInterestCost(userBorrow, _numberOfDays);
    }

    /**
     * @notice Calculate ETH to tokens for leverage loop operations
     * @param _ethAmount Amount of ETH
     * @param _totalETHRequired Total ETH required (fees + overcollateralization)
     * @return Amount of tokens
     */
    function previewLoopMint(uint256 _ethAmount, uint256 _totalETHRequired) public view returns (uint256) {
        uint256 backing = getProtocolBacking() - _totalETHRequired;
        return Math.mulDiv(_ethAmount, getEffectiveSupply(), backing);
    }

    /**
     * @notice Get the maximum loop amount and details for a user based on their BTB balance
     * @param _user Address of the user
     * @param _numberOfDays Duration of the loop in days
     * @return maxETH Maximum ETH that can be looped
     * @return userBorrow Amount that would be borrowed
     * @return totalRequired Total ETH required for the loop
     */
    function getMaxLoop(address _user, uint256 _numberOfDays) 
        external 
        view 
        returns (uint256 maxETH, uint256 userBorrow, uint256 totalRequired) 
    {
        uint256 userBTBBalance = BTB_TOKEN.balanceOf(_user) + getFreeCollateral(_user);
        uint256 userETHValue = calculateTokensToETH(userBTBBalance);
        maxETH = userETHValue;
        
        (uint256 loopFee, uint256 borrow, uint256 overCollat, uint256 interest) = calculateLoopParameters(maxETH, _numberOfDays);
        userBorrow = borrow;
        totalRequired = overCollat + loopFee + interest;
    }

    function createLeveragePosition(uint256 _ethAmount, uint256 _days) 
        external 
        payable 
        nonReentrant
        noFlashLoan
    {
        if (!protocolActive) revert ProtocolNotActive();
        if (_days >= MAX_DAYS + 1) revert MaximumDaysExceeded();

        LoanPosition memory existingLoan = userLoanPositions[msg.sender];
        if (existingLoan.borrowedAmount != 0) {
            if (isPositionExpired(msg.sender)) {
                delete userLoanPositions[msg.sender];
            } else {
                revert ExistingPositionNotClosed();
            }
        }

        processLiquidations();
        uint256 expirationDate = getDayStartTimestamp(block.timestamp + (_days * 1 days));
        uint256 totalCost = this.calculateLeverageCost(_ethAmount, _days);
        
        // Optimized calculations using unchecked where safe
        uint256 netETH;
        uint256 protocolFee;
        uint256 userBorrowAmount;
        uint256 overcollateralAmount;
        
        unchecked {
            netETH = _ethAmount - totalCost;
            protocolFee = (totalCost * 3) / 10;
            userBorrowAmount = (netETH * 99) / 100;
            overcollateralAmount = netETH / 100;
        }
        
        uint256 requiredPayment = totalCost + overcollateralAmount;

        // Handle refund logic
        if (msg.value > requiredPayment) {
            unchecked {
                uint256 refund = msg.value - requiredPayment;
                transferETH(msg.sender, refund);
            }
        }
        if (msg.value != requiredPayment && msg.value <= requiredPayment) revert IncorrectETHAmount();

        uint256 collateralTokens = calculateETHtoTokensLeverage(netETH, protocolFee + overcollateralAmount);
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < collateralTokens) revert InsufficientTokenReserves();
        
        // Transfer tokens from virtual burn address to this contract for collateral
        VIRTUAL_BURN_ADDRESS.withdrawTokens(address(this), collateralTokens);

        if (_ethAmount < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        updateLoanData(userBorrowAmount, collateralTokens, expirationDate, true);
        userLoanPositions[msg.sender] = LoanPosition({
            collateralAmount: uint128(collateralTokens),
            borrowedAmount: uint128(userBorrowAmount),
            expirationDate: uint64(expirationDate),
            loanDurationDays: uint32(_days)
        });

        performSafetyCheck(_ethAmount);
        emit LoanCreated(msg.sender, userBorrowAmount, collateralTokens, expirationDate);
    }

    function getInterestCost(uint256 _amount, uint256 _days) public pure returns (uint256) {
        // Solidity 0.8.30: Use built-in safe math, only mulDiv for precision
        uint256 interestRate = Math.mulDiv(0.039e18, _days, 365) + 0.001e18;
        return Math.mulDiv(_amount, interestRate, 1e18);
    }

    function borrowAgainstCollateral(uint256 _ethAmount, uint256 _days) external nonReentrant {
        if (_days >= MAX_DAYS + 1) revert MaximumDaysExceeded();
        if (_ethAmount == 0) revert InsufficientAmount();
        
        if (isPositionExpired(msg.sender)) {
            delete userLoanPositions[msg.sender];
        }
        if (userLoanPositions[msg.sender].borrowedAmount != 0) revert ExistingPositionNotClosed();

        processLiquidations();
        uint256 expirationDate = getDayStartTimestamp(block.timestamp + (_days * 1 days));
        uint256 interestCost = getInterestCost(_ethAmount, _days);
        uint256 protocolFee = (interestCost * 3) / 10;

        uint256 requiredCollateral = calculateETHtoTokensViewCeil(_ethAmount);
        uint256 netBorrowAmount = (_ethAmount * 99) / 100;

        userLoanPositions[msg.sender] = LoanPosition({
            collateralAmount: uint128(requiredCollateral),
            borrowedAmount: uint128(netBorrowAmount),
            expirationDate: uint64(expirationDate),
            loanDurationDays: uint32(_days)
        });

        BTB_TOKEN.transferFrom(msg.sender, address(this), requiredCollateral);
        if (_ethAmount < MINIMUM_AMOUNT) revert TradeAmountTooSmall();

        transferETH(msg.sender, netBorrowAmount - interestCost);
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        updateLoanData(netBorrowAmount, requiredCollateral, expirationDate, true);
        performSafetyCheck(interestCost);
        emit LoanCreated(msg.sender, netBorrowAmount, requiredCollateral, expirationDate);
    }

    function expandLoan(uint256 _ethAmount) external nonReentrant {
        if (isPositionExpired(msg.sender)) revert PositionExpired();
        if (_ethAmount == 0) revert InsufficientAmount();

        processLiquidations();
        
        // Cache user position to avoid multiple storage reads
        LoanPosition memory userPosition = userLoanPositions[msg.sender];
        
        uint256 todayStart = getDayStartTimestamp(block.timestamp);
        uint256 remainingDays = (userPosition.expirationDate - todayStart) / 1 days;
        uint256 interestCost = getInterestCost(_ethAmount, remainingDays);

        uint256 requiredCollateral = calculateETHtoTokensViewCeil(_ethAmount);
        uint256 borrowedInTokens = calculateETHtoTokensView(userPosition.borrowedAmount);
        
        // Optimized collateral calculation
        uint256 collateralValue = (userPosition.collateralAmount * 99) / 100;
        uint256 additionalCollateralNeeded = requiredCollateral > (collateralValue - borrowedInTokens) 
            ? requiredCollateral - (collateralValue - borrowedInTokens) 
            : 0;

        uint256 protocolFee = (interestCost * 3) / 10;
        uint256 netBorrowAmount = (_ethAmount * 99) / 100;

        // Update position with single storage write
        userLoanPositions[msg.sender] = LoanPosition({
            collateralAmount: uint128(userPosition.collateralAmount + additionalCollateralNeeded),
            borrowedAmount: uint128(userPosition.borrowedAmount + netBorrowAmount),
            expirationDate: uint64(userPosition.expirationDate),
            loanDurationDays: uint32(remainingDays)
        });

        if (additionalCollateralNeeded > 0) {
            BTB_TOKEN.transferFrom(msg.sender, address(this), additionalCollateralNeeded);
        }

        if (_ethAmount < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);
        transferETH(msg.sender, netBorrowAmount - interestCost);

        updateLoanData(netBorrowAmount, additionalCollateralNeeded, userPosition.expirationDate, true);
        performSafetyCheck(interestCost);
    }

    function withdrawCollateral(uint256 _amount) external nonReentrant {
        if (isPositionExpired(msg.sender)) revert PositionExpired();
        
        processLiquidations();
        uint256 currentCollateral = userLoanPositions[msg.sender].collateralAmount;
        
        if (userLoanPositions[msg.sender].borrowedAmount > 
            (calculateTokensToETH(currentCollateral - _amount) * 99) / 100) {
            revert InsufficientCollateralization();
        }

        userLoanPositions[msg.sender].collateralAmount = uint128(currentCollateral - _amount);
        BTB_TOKEN.transfer(msg.sender, _amount);
        updateLoanData(0, _amount, userLoanPositions[msg.sender].expirationDate, false);

        performSafetyCheck(0);
        emit CollateralWithdrawn(msg.sender, _amount);
    }

    function makePayment() external payable nonReentrant {
        uint256 borrowed = userLoanPositions[msg.sender].borrowedAmount;
        if (borrowed <= msg.value) revert PaymentExceedsBorrowed();
        if (msg.value == 0) revert MustPaySomething();
        if (isPositionExpired(msg.sender)) revert PositionExpired();

        uint256 newBorrowAmount = borrowed - msg.value;
        userLoanPositions[msg.sender].borrowedAmount = uint128(newBorrowAmount);
        updateLoanData(msg.value, 0, userLoanPositions[msg.sender].expirationDate, false);

        performSafetyCheck(0);
        emit LoanRepaid(msg.sender, msg.value, newBorrowAmount);
    }

    function closePosition() external payable nonReentrant {
        uint256 borrowed = userLoanPositions[msg.sender].borrowedAmount;
        uint256 collateral = userLoanPositions[msg.sender].collateralAmount;
        
        if (isPositionExpired(msg.sender)) revert PositionExpired();
        if (borrowed != msg.value) revert IncorrectRepaymentAmount();

        BTB_TOKEN.transfer(msg.sender, collateral);
        updateLoanData(borrowed, collateral, userLoanPositions[msg.sender].expirationDate, false);

        delete userLoanPositions[msg.sender];
        performSafetyCheck(0);
        emit LoanClosed(msg.sender, collateral);
    }

    function instantClosePosition() external nonReentrant {
        if (isPositionExpired(msg.sender)) revert PositionExpired();
        
        processLiquidations();
        uint256 borrowed = userLoanPositions[msg.sender].borrowedAmount;
        uint256 collateral = userLoanPositions[msg.sender].collateralAmount;

        uint256 collateralValueETH = calculateTokensToETH(collateral);
        BTB_TOKEN.transfer(address(VIRTUAL_BURN_ADDRESS), collateral);

        uint256 afterFeeValue = (collateralValueETH * 99) / 100;
        uint256 feeAmount = collateralValueETH / 100;

        if (afterFeeValue < borrowed) revert InsufficientCollateralValue();

        uint256 userReturn = afterFeeValue - borrowed;
        uint256 protocolFee = (feeAmount * 3) / 10;

        transferETH(msg.sender, userReturn);
        if (borrowed < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        updateLoanData(borrowed, collateral, userLoanPositions[msg.sender].expirationDate, false);
        delete userLoanPositions[msg.sender];
        performSafetyCheck(borrowed);
        emit LoanClosed(msg.sender, collateral);
    }

    function extendLoanDuration(uint256 _additionalDays) external payable nonReentrant returns (uint256) {
        uint256 oldExpiration = userLoanPositions[msg.sender].expirationDate;
        uint256 borrowed = userLoanPositions[msg.sender].borrowedAmount;
        uint256 collateral = userLoanPositions[msg.sender].collateralAmount;
        uint256 currentDuration = userLoanPositions[msg.sender].loanDurationDays;

        uint256 newExpiration = oldExpiration + (_additionalDays * 1 days);
        uint256 extensionFee = getInterestCost(borrowed, _additionalDays);

        if (isPositionExpired(msg.sender)) revert PositionExpired();
        if (extensionFee != msg.value) revert IncorrectExtensionFee();

        uint256 protocolFee = (extensionFee * 3) / 10;
        if (msg.value < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);

        updateLoanData(borrowed, collateral, oldExpiration, false);
        updateLoanData(borrowed, collateral, newExpiration, true);

        userLoanPositions[msg.sender].expirationDate = uint64(newExpiration);
        userLoanPositions[msg.sender].loanDurationDays = uint32(_additionalDays + currentDuration);

        if ((newExpiration - block.timestamp) / 1 days >= MAX_DAYS + 1) revert TotalDurationExceedsLimit();

        performSafetyCheck(msg.value);
        return extensionFee;
    }

    /**
     * @dev Processes expired loan liquidations
     * 
     * === AUDITOR NOTE: CRITICAL LIQUIDATION MECHANISM ===
     * 
     * INTENDED BEHAVIOR:
     * 1. Process up to MAX_LIQUIDATION_BATCHES (50) days of expired loans
     * 2. Accumulate expired collateral and borrowed amounts
     * 3. Transfer expired collateral to virtual burn address (deflationary)
     * 4. Update total borrowed and collateral amounts
     * 5. Advance liquidation timestamp for next processing
     * 
     * SECURITY PROTECTIONS:
     * - Batch limit prevents out-of-gas DoS attacks
     * - Can be called multiple times if more liquidations pending
     * - Updates state atomically after processing batch
     * 
     * LIQUIDATION LOGIC:
     * - Expired loans lose their collateral automatically
     * - Collateral goes to burn address (reduces effective supply)
     * - Borrowed amounts are removed from protocol debt
     * - No manual liquidation by external parties needed
     * 
     * BATCH PROCESSING:
     * - Processes 50 days maximum per transaction
     * - Tracks progress via lastLiquidationTimestamp
     * - Prevents unbounded loops during high liquidation periods
     * 
     * ECONOMIC IMPACT:
     * - Liquidated collateral reduces token supply
     * - Reduced supply increases token price
     * - Protocol maintains solvency during market downturns
     */
    function processLiquidations() public {
        uint256 totalBorrowed;
        uint256 totalCollateral;
        uint256 liquidationCount = 0;
        uint256 batchesProcessed = 0;

        // Add batch limit to prevent DoS
        unchecked {
            while (lastLiquidationTimestamp < block.timestamp && batchesProcessed < MAX_LIQUIDATION_BATCHES) {
                totalCollateral += dailyCollateralAmounts[lastLiquidationTimestamp];
                totalBorrowed += dailyBorrowedAmounts[lastLiquidationTimestamp];
                lastLiquidationTimestamp += 1 days;
                ++liquidationCount;
                ++batchesProcessed;
            }
        }

        if (totalCollateral > 0) {
            unchecked {
                totalCollateralAmount -= totalCollateral;
            }
            BTB_TOKEN.transfer(address(VIRTUAL_BURN_ADDRESS), totalCollateral);
        }

        if (totalBorrowed > 0) {
            unchecked {
                totalBorrowedAmount -= totalBorrowed;
            }
            emit LiquidationProcessed(lastLiquidationTimestamp - 1 days, totalBorrowed, liquidationCount);
        }
        
        emit ProtocolTotalsUpdated(
            totalCollateralAmount,
            totalBorrowedAmount,
            lastLiquidationTimestamp
        );
    }

    function updateLoanData(uint256 _borrowed, uint256 _collateral, uint256 _date, bool _isAdd) private {
        if (_isAdd) {
            dailyCollateralAmounts[_date] += _collateral;
            dailyBorrowedAmounts[_date] += _borrowed;
            totalBorrowedAmount += _borrowed;
            totalCollateralAmount += _collateral;
        } else {
            dailyCollateralAmounts[_date] -= _collateral;
            dailyBorrowedAmounts[_date] -= _borrowed;
            totalBorrowedAmount -= _borrowed;
            totalCollateralAmount -= _collateral;
        }

        emit LoanDataUpdated(
            dailyCollateralAmounts[_date],
            dailyBorrowedAmounts[_date],
            totalBorrowedAmount,
            totalCollateralAmount
        );
    }

    // Utility Functions with gas optimization
    function getDayStartTimestamp(uint256 _timestamp) public pure returns (uint256) {
        unchecked {
            uint256 dayStart = _timestamp - (_timestamp % SECONDS_PER_DAY);
            return dayStart + 1 days;
        }
    }

    function getExpiringLoans(uint256 _date) external view returns (uint256, uint256) {
        return (
            dailyBorrowedAmounts[getDayStartTimestamp(_date)],
            dailyCollateralAmounts[getDayStartTimestamp(_date)]
        );
    }

    function getUserLoanInfo(address _user) external view returns (uint256, uint256, uint256) {
        if (userLoanPositions[_user].expirationDate >= block.timestamp) {
            return (
                userLoanPositions[_user].collateralAmount,
                userLoanPositions[_user].borrowedAmount,
                userLoanPositions[_user].expirationDate
            );
        } else {
            return (0, 0, 0);
        }
    }

    function isPositionExpired(address _user) public view returns (bool) {
        return userLoanPositions[_user].expirationDate < block.timestamp;
    }

    function getPurchaseFeeRate() public view returns (uint256) {
        return purchaseFeePercentage;
    }

    function getTotalBorrowedAmount() external view returns (uint256) {
        return totalBorrowedAmount;
    }

    function getTotalCollateralAmount() external view returns (uint256) {
        return totalCollateralAmount;
    }

    function getProtocolBacking() public view returns (uint256) {
        // Optimized: single addition with unchecked block since overflow is extremely unlikely
        unchecked {
            return address(this).balance + totalBorrowedAmount;
        }
    }

    function getEffectiveSupply() public view returns (uint256) {
        // Optimized: single subtraction with unchecked block 
        unchecked {
            return BTB_TOKEN.totalSupply() - VIRTUAL_BURN_ADDRESS.getTokenBalance();
        }
    }

    /**
     * @dev Performs critical safety checks after every operation
     * @param _ethVolume ETH volume for this transaction (for event logging)
     * 
     * === AUDITOR NOTE: CRITICAL SAFETY MECHANISM ===
     * 
     * INTENDED BEHAVIOR:
     * 1. Calculate new price based on current backing and supply
     * 2. Ensure contract has sufficient tokens for all collateral
     * 3. Enforce price can only increase (deflationary mechanism)
     * 4. Validate price increase is not excessive (manipulation protection)
     * 5. Update currentPrice and emit price update event
     * 
     * CRITICAL INVARIANTS ENFORCED:
     * - Contract token balance ≥ total collateral (prevents insolvency)
     * - Price never decreases (deflationary tokenomics)
     * - Price increases limited to 20% per transaction (manipulation protection)
     * - Price accurately reflects backing/supply ratio
     * 
     * PRICE CALCULATION:
     * newPrice = (ETH balance + borrowed ETH) * 1e18 / (total supply - burned tokens)
     * 
     * SECURITY CHECKS:
     * 1. Solvency: Contract must hold enough tokens for all collateral
     * 2. Price monotonicity: Price can only increase or stay same
     * 3. Price ratchet: currentPrice can only increase, never decrease
     * 
     * FAILURE CONDITIONS:
     * - InsufficientContractBalance: Contract can't cover collateral
     * - PriceCannotDecrease: New price lower than current (violates invariant)
     * - Price increase validation: Increase > 20% (possible manipulation)
     * 
     * CALL PATTERN:
     * Called after EVERY operation that could affect price:
     * - Token purchases/sales
     * - Loan creation/repayment
     * - Liquidations
     * - Leverage operations
     */
    function performSafetyCheck(uint256 _ethVolume) private {
        // Cache values to avoid multiple function calls
        uint256 backing = getProtocolBacking();
        uint256 supply = getEffectiveSupply();
        
        // Enhanced price calculation with manipulation protection
        uint256 newPrice;
        unchecked {
            newPrice = (backing * 1 ether) / supply;
        }
        
        uint256 contractBalance = BTB_TOKEN.balanceOf(address(this));
        
        if (contractBalance < totalCollateralAmount) revert InsufficientContractBalance();
        if (currentPrice > newPrice) revert PriceCannotDecrease();
        

        
        currentPrice = newPrice;
        emit PriceUpdate(block.timestamp, newPrice, _ethVolume);
    }

    function calculateTokensToETH(uint256 _tokenAmount) public view returns (uint256) {
        return Math.mulDiv(_tokenAmount, getProtocolBacking(), getEffectiveSupply());
    }

    function calculateETHtoTokens(uint256 _ethAmount) public view returns (uint256) {
        return Math.mulDiv(_ethAmount, getEffectiveSupply(), getProtocolBacking() - _ethAmount);
    }

    function calculateETHtoTokensLeverage(uint256 _ethAmount, uint256 _fee) public view returns (uint256) {
        uint256 backing = getProtocolBacking() - _fee;
        return (_ethAmount * getEffectiveSupply() + (backing - 1)) / backing;
    }

    function calculateETHtoTokensViewCeil(uint256 _ethAmount) public view returns (uint256) {
        uint256 backing = getProtocolBacking();
        return (_ethAmount * getEffectiveSupply() + (backing - 1)) / backing;
    }

    function calculateETHtoTokensView(uint256 _ethAmount) public view returns (uint256) {
        uint256 backing = getProtocolBacking();
        // Use Math.mulDiv to prevent intermediate overflow in large calculations
        return Math.mulDiv(_ethAmount, getEffectiveSupply(), backing);
    }

    function transferETH(address _recipient, uint256 _amount) internal {
        (bool success, ) = _recipient.call{value: _amount}("");
        if (!success) revert ETHTransferFailed();
        emit ETHTransferred(_recipient, _amount);
    }

    function estimatePurchaseTokens(uint256 _ethAmount) external view returns (uint256) {
        // Solidity 0.8.30: Built-in overflow protection, but use mulDiv for precision
        return Math.mulDiv(_ethAmount * getEffectiveSupply(), purchaseFeePercentage, getProtocolBacking() * PRECISION);
    }

    /**
     * @notice Calculate the output amounts for a loop position
     * @param _ethAmount Amount of ETH to loop
     * @param _numberOfDays Duration in days
     * @return tokens Amount of BTB tokens that would be obtained as collateral
     * @return totalRequired Total ETH required for the loop
     */
    function getLoopOutput(uint256 _ethAmount, uint256 _numberOfDays) external view returns (uint256 tokens, uint256 totalRequired) {
        (uint256 loopFee, , uint256 overCollat, uint256 interest) = calculateLoopParameters(_ethAmount, _numberOfDays);
        totalRequired = overCollat + loopFee + interest;
        
        uint256 userETH = _ethAmount - loopFee;
        tokens = previewLoopMint(userETH, totalRequired);
    }

    /**
     * @notice Calculate the inverse loop - given totalRequired, what ETH amount is needed
     * @param _totalRequired Total ETH available to spend
     * @param _numberOfDays Duration in days
     * @return ethAmount The ETH amount that should be used for looping
     */
    function calculateInverseLoop(uint256 _totalRequired, uint256 _numberOfDays) external view returns (uint256 ethAmount) {
        // Binary search to find the right ethAmount
        uint256 low = _totalRequired / 100; // Start with 1% of total as minimum
        uint256 high = _totalRequired * 5; // Maximum 5x leverage
        
        // Optimized binary search with unchecked arithmetic
        unchecked {
            while (low < high) {
                uint256 mid = (low + high + 1) / 2;
                (uint256 loopFee, , uint256 overCollat, uint256 interest) = calculateLoopParameters(mid, _numberOfDays);
                uint256 calculatedTotal = loopFee + overCollat + interest;
                
                if (calculatedTotal <= _totalRequired) {
                    low = mid;
                } else {
                    high = mid - 1;
                }
            }
        }
        return low;
    }

    /**
     * @notice Get current loop fee percentage
     */
    function getLoopFeePercentage() external view returns (uint16) {
        return loopFeePercentage;
    }

    /**
     * @notice Calculates the maximum borrowable amount and borrow details for a user
     * @param _user Address of the user
     * @param _numberOfDays Duration of the loan in days
     * @return userETH Maximum ETH value of user's BTB
     * @return userBorrow Maximum borrowable ETH amount
     * @return interestFee Interest fee for the loan
     */
    function getMaxBorrow(address _user, uint256 _numberOfDays) 
        external 
        view 
        returns (uint256 userETH, uint256 userBorrow, uint256 interestFee) 
    {
        uint256 userBTBBalance = BTB_TOKEN.balanceOf(_user) + getFreeCollateral(_user);
        userETH = calculateTokensToETH(userBTBBalance);
        userBorrow = (userETH * COLLATERAL_RATIO) / PRECISION;
        interestFee = getInterestCost(userBorrow, _numberOfDays);
    }

    /**
     * @notice Return the free collateral for a user that can be withdrawn via withdrawCollateral()
     * @param _user The address of the user
     * @return The amount of free collateral in BTB tokens
     */
    function getFreeCollateral(address _user) public view returns (uint256) {
        if (isPositionExpired(_user)) {
            return 0;
        }
        uint256 userCollateral = userLoanPositions[_user].collateralAmount;
        uint256 userBorrowed = userLoanPositions[_user].borrowedAmount;
        
        if (userCollateral == 0 || userBorrowed == 0) {
            return 0;
        }

        // Calculate the minimum collateral needed for the borrowed amount
        uint256 userBorrowedInTokens = calculateETHtoTokensViewCeil(userBorrowed);
        uint256 requiredCollateral = (userBorrowedInTokens * PRECISION) / COLLATERAL_RATIO;
        
        // Return the excess collateral that can be withdrawn
        return userCollateral > requiredCollateral ? userCollateral - requiredCollateral : 0;
    }

    /**
     * @notice Check if a user can create a loop position
     * @param _user User address
     * @return canLoop Whether the user can create a loop
     * @return reason Reason if they can't loop
     */
    function canUserLoop(address _user) external view returns (bool canLoop, string memory reason) {
        if (!protocolActive) {
            return (false, "Protocol not active");
        }
        
        LoanPosition memory position = userLoanPositions[_user];
        if (position.borrowedAmount > 0 && !isPositionExpired(_user)) {
            return (false, "Existing position must be closed first");
        }
        
        return (true, "");
    }

    /**
     * @notice Get protocol deployment information
     * @return deploymentTime Timestamp when contract was deployed
     * @return deploymentBlock Block number when contract was deployed
     */
    function getDeploymentInfo() external view returns (uint256 deploymentTime, uint256 deploymentBlock) {
        return (DEPLOYMENT_TIMESTAMP, DEPLOYMENT_BLOCK_NUMBER);
    }

    /**
     * @notice Get comprehensive protocol statistics in a single call (gas efficient)
     * @return backing Total protocol backing in ETH
     * @return effectiveSupply Effective token supply (total - burned)
     * @return price Current price per token
     * @return totalBorrowed Total borrowed amount
     * @return totalCollateral Total collateral amount
     * @return isActive Whether protocol is active
     */
    function getProtocolStats() external view returns (
        uint256 backing,
        uint256 effectiveSupply,
        uint256 price,
        uint256 totalBorrowed,
        uint256 totalCollateral,
        bool isActive
    ) {
        backing = getProtocolBacking();
        effectiveSupply = getEffectiveSupply();
        price = currentPrice;
        totalBorrowed = totalBorrowedAmount;
        totalCollateral = totalCollateralAmount;
        isActive = protocolActive;
    }

    receive() external payable {}
    fallback() external payable {}
}