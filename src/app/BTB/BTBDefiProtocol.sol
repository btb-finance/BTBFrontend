//SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IERC1820Registry {
    function getInterfaceImplementer(address _addr, bytes32 _interfaceHash) external view returns (address);
}
error InvalidRecipient();
error InsufficientAmount();
error InsufficientBalance();
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
error UnsafeTokenType();
error TokenOperationInProgress();
error TokenTransferFailed();
error TransferVerificationFailed();
error TooManyUsers();
error CollateralUnderflow();
error BorrowedUnderflow();
error TotalBorrowedUnderflow();
error TotalCollateralUnderflow();
error FlashLoanProtection();
contract VirtualBurnAddress is Ownable2Step, ReentrancyGuard {
    IERC20 public immutable BTB_TOKEN;
    bytes4 private constant ERC777_INTERFACE = 0xac7fbab5;
    bytes32 private constant ERC777_TOKEN_HASH = keccak256("ERC777Token");
    address private constant ERC1820_REGISTRY = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;
    bool private _tokenOperationLocked;

    event TokensWithdrawn(address indexed to, uint256 amount);
    event TokensReceived(address indexed from, uint256 amount);

    modifier tokenOperationLock() {
        if (_tokenOperationLocked) revert TokenOperationInProgress();
        _tokenOperationLocked = true;
        _;
        _tokenOperationLocked = false;
    }

    constructor(address _btbToken, address _owner) Ownable(_owner) {
        if (_btbToken == address(0)) revert InvalidRecipient();
        if (_isERC777(_btbToken)) revert UnsafeTokenType();
        BTB_TOKEN = IERC20(_btbToken);
    }
    function _isERC777(address _token) private view returns (bool) {
        try IERC1820Registry(ERC1820_REGISTRY).getInterfaceImplementer(_token, ERC777_TOKEN_HASH) returns (address impl) {
            if (impl != address(0)) return true;
        } catch {}
        try IERC165(_token).supportsInterface(ERC777_INTERFACE) returns (bool supported) {
            return supported;
        } catch {
            return false;
        }
    }

    function withdrawTokens(address _to, uint256 _amount) external onlyOwner nonReentrant tokenOperationLock {
        if (_to == address(0)) revert InvalidRecipient();
        if (_amount == 0) revert InsufficientAmount();
        uint256 currentBalance = BTB_TOKEN.balanceOf(address(this));
        if (currentBalance < _amount) revert InsufficientBalance();
        bool success = BTB_TOKEN.transfer(_to, _amount);
        if (!success) revert TokenTransferFailed();
        uint256 newBalance = BTB_TOKEN.balanceOf(address(this));
        if (newBalance != currentBalance - _amount) revert TransferVerificationFailed();
        emit TokensWithdrawn(_to, _amount);
    }

    function getTokenBalance() external view returns (uint256) {
        return BTB_TOKEN.balanceOf(address(this));
    }

    function isTokenSafe() external view returns (bool) {
        return !_isERC777(address(BTB_TOKEN));
    }

    function verifyTokenSafety() external view returns (bool isSafe, bool registryCheck, bool interfaceCheck, string memory message) {
        address tokenAddr = address(BTB_TOKEN);
        bool hasRegistryEntry = false;
        try IERC1820Registry(ERC1820_REGISTRY).getInterfaceImplementer(tokenAddr, ERC777_TOKEN_HASH) returns (address impl) {
            hasRegistryEntry = (impl != address(0));
        } catch {}
        bool hasInterface = false;
        try IERC165(tokenAddr).supportsInterface(ERC777_INTERFACE) returns (bool supported) {
            hasInterface = supported;
        } catch {}
        if (hasRegistryEntry) {
            return (false, true, hasInterface, "DANGER: Token registered as ERC-777 in ERC-1820 registry");
        } else if (hasInterface) {
            return (false, false, true, "WARNING: Token claims ERC-777 interface support");
        } else {
            return (true, false, false, "SAFE: No ERC-777 detection methods triggered");
        }
    }

    function getTokenSafetySummary() external view returns (string memory summary) {
        (bool isSafe, bool registryCheck, bool interfaceCheck, string memory message) = this.verifyTokenSafety();
        if (!isSafe) {
            return string(
                abi.encodePacked(
                    "UNSAFE TOKEN DETECTED: ",
                    message,
                    " | Registry: ",
                    registryCheck ? "YES" : "NO",
                    " | Interface: ",
                    interfaceCheck ? "YES" : "NO"
                )
            );
        }
        return "Token safety verified - no ERC-777 indicators found";
    }

    function receiveTokens(uint256 _amount) external nonReentrant tokenOperationLock {
        if (_amount == 0) revert InsufficientAmount();
        uint256 balanceBefore = BTB_TOKEN.balanceOf(address(this));
        bool success = BTB_TOKEN.transferFrom(msg.sender, address(this), _amount);
        if (!success) revert TokenTransferFailed();
        uint256 balanceAfter = BTB_TOKEN.balanceOf(address(this));
        if (balanceAfter != balanceBefore + _amount) revert TransferVerificationFailed();
        emit TokensReceived(msg.sender, _amount);
    }
}

contract BTBDefiProtocol is Ownable2Step, ReentrancyGuard {
    IERC20 public immutable BTB_TOKEN;
    VirtualBurnAddress public immutable VIRTUAL_BURN_ADDRESS;
    address payable public PROTOCOL_FEE_RECEIVER;

    uint256 private constant MINIMUM_AMOUNT = 10_000;
    uint256 private constant PRECISION = 10_000;
    uint256 private constant COLLATERAL_RATIO = 9_900;
    uint256 private constant MAX_DAYS = 365;
    uint256 private constant SECONDS_PER_DAY = 86_400;
    uint256 private constant PRICE_ROUNDING_TOLERANCE = 1000;
    uint256 private immutable DEPLOYMENT_TIMESTAMP;
    uint256 private immutable DEPLOYMENT_BLOCK_NUMBER;
    uint16 public tradingFeePercentage = 9_950;
    uint16 public purchaseFeePercentage = 9_950;
    uint16 public leverageFeePercentage = 100;
    uint16 public loopFeePercentage = 142;
    mapping(address => bool) public arbitrageWhitelist;

    bool public protocolActive;
    uint256 public currentPrice;
    uint256 public totalBorrowedAmount;
    uint256 public totalCollateralAmount;
    uint256 public lastLiquidationTimestamp;
    uint256 public activationFee = 0.001 ether;

    struct LoanPosition {
        uint128 collateralAmount;
        uint128 borrowedAmount;
        uint64 expirationDate;
        uint32 loanDurationDays;
    }

    mapping(address => LoanPosition) public userLoanPositions;
    mapping(uint256 => uint256) public dailyBorrowedAmounts;
    mapping(uint256 => uint256) public dailyCollateralAmounts;

    event PriceUpdate(uint256 indexed timestamp, uint256 newPrice, uint256 volumeETH);
    event ProtocolActivated(bool indexed isActive);
    event LiquidationEvent(uint256 indexed timestamp, uint256 liquidatedAmount);
    event LoanDataUpdated(uint256 collateralByDate, uint256 borrowedByDate, uint256 totalBorrowed, uint256 totalCollateral);
    event ETHTransferred(address indexed recipient, uint256 amount);
    event FeeReceiverUpdated(address indexed newReceiver);
    event TradingFeeUpdated(uint256 newFee);
    event PurchaseFeeUpdated(uint256 newFee);
    event LeverageFeeUpdated(uint256 newFee);
    event LoopFeeUpdated(uint256 newFee);
    event LoopCreated(address indexed user, uint256 ethAmount, uint256 numberOfDays, uint256 userTokens, uint256 userBorrow, uint256 totalRequired);
    event TokensPurchased(address indexed user, uint256 ethAmount, uint256 tokensReceived);
    event TokensSold(address indexed user, uint256 tokensAmount, uint256 ethReceived);
    event LoanCreated(address indexed user, uint256 ethAmount, uint256 collateralAmount, uint256 expirationDate);
    event LoanRepaid(address indexed user, uint256 amount, uint256 remainingDebt);
    event LoanClosed(address indexed user, uint256 collateralReturned);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event LiquidationProcessed(uint256 indexed date, uint256 amount, uint256 count);
    event ProtocolTotalsUpdated(uint256 totalCollateral, uint256 totalBorrowed, uint256 timestamp);
    event ArbitrageWhitelistAdded(address indexed account, address indexed addedBy);
    event ArbitrageWhitelistRemoved(address indexed account, address indexed removedBy);
    event ArbitragePurchase(address indexed user, uint256 ethAmount, uint256 tokensReceived);
    event ArbitrageSale(address indexed user, uint256 tokensAmount, uint256 ethReceived);
    event BatchLiquidation(uint256 usersLiquidated, uint256 totalCollateralLiquidated, address[] liquidatedUsers);

    mapping(address => uint256) private lastTransactionBlock;
    uint256 private constant FLASH_LOAN_PROTECTION_BLOCKS = 1;

    modifier noFlashLoan() {
        if (lastTransactionBlock[tx.origin] >= block.number) revert FlashLoanProtection();
        lastTransactionBlock[tx.origin] = block.number;
        _;
    }

    uint256 private constant MAX_LIQUIDATION_BATCHES = 50;
    uint256 private constant MAX_BATCH_LIQUIDATIONS = 100;

    constructor(address _btbToken) Ownable(msg.sender) {
        if (_btbToken == address(0)) revert InvalidRecipient();
        BTB_TOKEN = IERC20(_btbToken);
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

        uint256 initialTokens = 2_500 * 10 ** 18;
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < initialTokens) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(address(this), initialTokens);
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
        if (_feePercentage < 9_500 || _feePercentage > 9_995) revert FeeRangeInvalid();
        tradingFeePercentage = _feePercentage;
        emit TradingFeeUpdated(_feePercentage);
    }

    function updatePurchaseFee(uint16 _feePercentage) external onlyOwner {
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

    function addArbitrageWhitelist(address _account) external onlyOwner {
        if (_account == address(0)) revert InvalidRecipient();
        arbitrageWhitelist[_account] = true;
        emit ArbitrageWhitelistAdded(_account, msg.sender);
    }

    function removeArbitrageWhitelist(address _account) external onlyOwner {
        arbitrageWhitelist[_account] = false;
        emit ArbitrageWhitelistRemoved(_account, msg.sender);
    }

    function isArbitrageWhitelisted(address _account) external view returns (bool isWhitelisted) {
        return arbitrageWhitelist[_account];
    }

    function purchaseTokens(address _recipient) external payable nonReentrant noFlashLoan {
        processLiquidations();
        if (_recipient == address(0)) revert InvalidRecipient();
        uint256 tokensToSend = calculateETHtoTokens(msg.value);
        uint256 userTokens = (tokensToSend * getPurchaseFeeRate()) / PRECISION;
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < userTokens) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(_recipient, userTokens);
        uint256 protocolFee = msg.value * (PRECISION - purchaseFeePercentage) / PRECISION;
        if (msg.value < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);
        performSafetyCheck(msg.value);
        emit TokensPurchased(_recipient, msg.value, userTokens);
    }

    function sellTokens(uint256 _tokenAmount) external nonReentrant {
        processLiquidations();
        if (_tokenAmount == 0) revert InsufficientAmount();
        uint256 ethToSend = calculateTokensToETH(_tokenAmount);
        BTB_TOKEN.transferFrom(msg.sender, address(VIRTUAL_BURN_ADDRESS), _tokenAmount);
        uint256 userETH = (ethToSend * tradingFeePercentage) / PRECISION;
        uint256 protocolFee = ethToSend - userETH;
        transferETH(msg.sender, userETH);
        if (ethToSend < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);
        performSafetyCheck(ethToSend);
        emit TokensSold(msg.sender, _tokenAmount, userETH);
    }

    function arbitragePurchase(address _recipient) external payable nonReentrant noFlashLoan {
        if (!arbitrageWhitelist[msg.sender]) revert InvalidRecipient();
        processLiquidations();
        if (_recipient == address(0)) revert InvalidRecipient();
        uint256 tokensToSend = calculateETHtoTokens(msg.value);
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < tokensToSend) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(_recipient, tokensToSend);
        performSafetyCheck(msg.value);
        emit ArbitragePurchase(_recipient, msg.value, tokensToSend);
    }

    function arbitrageSell(uint256 _tokenAmount) external nonReentrant {
        if (!arbitrageWhitelist[msg.sender]) revert InvalidRecipient();
        processLiquidations();
        if (_tokenAmount == 0) revert InsufficientAmount();
        uint256 ethToSend = calculateTokensToETH(_tokenAmount);
        BTB_TOKEN.transferFrom(msg.sender, address(VIRTUAL_BURN_ADDRESS), _tokenAmount);
        transferETH(msg.sender, ethToSend);
        performSafetyCheck(ethToSend);
        emit ArbitrageSale(msg.sender, _tokenAmount, ethToSend);
    }

    function calculatePurchaseAmount(uint256 _ethAmount) external view returns (uint256) {
        uint256 tokens = calculateETHtoTokensView(_ethAmount);
        return (tokens * getPurchaseFeeRate()) / PRECISION;
    }

    function calculateArbitragePurchase(uint256 _ethAmount) external view returns (uint256 tokensOut) {
        return calculateETHtoTokensView(_ethAmount);
    }

    function calculateArbitrageSale(uint256 _tokenAmount) external view returns (uint256 ethOut) {
        return calculateTokensToETH(_tokenAmount);
    }

    function calculateLeverageCost(uint256 _ethAmount, uint256 _days) external view returns (uint256) {
        uint256 leverageFee = (_ethAmount * leverageFeePercentage) / PRECISION;
        uint256 interestCost = getInterestCost(_ethAmount, _days);
        return leverageFee + interestCost;
    }


    function createLoopPosition(uint256 _ethAmount, uint256 _numberOfDays) external payable nonReentrant noFlashLoan {
        if (_numberOfDays >= MAX_DAYS + 1) revert MaximumDaysExceeded();
        if (_ethAmount == 0) revert InsufficientAmount();


        LoanPosition memory existingLoan = userLoanPositions[msg.sender];
        if (existingLoan.borrowedAmount != 0) {
            if (isPositionExpired(msg.sender)) {
                updateLoanData(existingLoan.borrowedAmount, existingLoan.collateralAmount, existingLoan.expirationDate, false);
                BTB_TOKEN.transfer(address(VIRTUAL_BURN_ADDRESS), existingLoan.collateralAmount);
                delete userLoanPositions[msg.sender];
            } else {
                revert ExistingPositionNotClosed();
            }
        }

        processLiquidations();
        uint256 expirationDate = getDayStartTimestamp(block.timestamp + (_numberOfDays * 1 days));


        (uint256 loopFee, uint256 userBorrow, uint256 overCollateralizationAmount, uint256 interestFee) =
            calculateLoopParameters(_ethAmount, _numberOfDays);

        uint256 totalETHRequired = overCollateralizationAmount + loopFee + interestFee;


        if (msg.value > totalETHRequired) {
            transferETH(msg.sender, msg.value - totalETHRequired);
        }
        if (msg.value < totalETHRequired) revert IncorrectETHAmount();

        uint256 userETH = _ethAmount - loopFee;
        uint256 userTokens = previewLoopMint(userETH, totalETHRequired);
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < userTokens) revert InsufficientTokenReserves();
        VIRTUAL_BURN_ADDRESS.withdrawTokens(address(this), userTokens);


        uint256 protocolFee = (loopFee + interestFee) * 35 / 100;
        if (_ethAmount < MINIMUM_AMOUNT) revert TradeAmountTooSmall();
        transferETH(PROTOCOL_FEE_RECEIVER, protocolFee);


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


    function previewLoopMint(uint256 _ethAmount, uint256 _totalETHRequired) public view returns (uint256) {
        uint256 backing = getProtocolBacking() - _totalETHRequired;
        return Math.mulDiv(_ethAmount, getEffectiveSupply(), backing);
    }


    function getMaxLoop(address _user, uint256 _numberOfDays)
        external
        view
        returns (uint256 maxETH, uint256 userBorrow, uint256 totalRequired)
    {
        uint256 userBTBBalance = BTB_TOKEN.balanceOf(_user) + getFreeCollateral(_user);
        uint256 userETHValue = calculateTokensToETH(userBTBBalance);
        maxETH = userETHValue;

        (uint256 loopFee, uint256 borrow, uint256 overCollat, uint256 interest) =
            calculateLoopParameters(maxETH, _numberOfDays);
        userBorrow = borrow;
        totalRequired = overCollat + loopFee + interest;
    }

    function createLeveragePosition(uint256 _ethAmount, uint256 _days) external payable nonReentrant noFlashLoan {
        if (_days >= MAX_DAYS + 1) revert MaximumDaysExceeded();
        if (_ethAmount == 0) revert InsufficientAmount();

        LoanPosition memory existingLoan = userLoanPositions[msg.sender];
        if (existingLoan.borrowedAmount != 0) {
            if (isPositionExpired(msg.sender)) {
                updateLoanData(existingLoan.borrowedAmount, existingLoan.collateralAmount, existingLoan.expirationDate, false);
                BTB_TOKEN.transfer(address(VIRTUAL_BURN_ADDRESS), existingLoan.collateralAmount);
                delete userLoanPositions[msg.sender];
            } else {
                revert ExistingPositionNotClosed();
            }
        }

        processLiquidations();
        uint256 expirationDate = getDayStartTimestamp(block.timestamp + (_days * 1 days));
        uint256 totalCost = this.calculateLeverageCost(_ethAmount, _days);


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


        if (msg.value > requiredPayment) {
            transferETH(msg.sender, msg.value - requiredPayment);
        }
        if (msg.value < requiredPayment) revert IncorrectETHAmount();

        uint256 collateralTokens = calculateETHtoTokensLeverage(netETH, protocolFee + overcollateralAmount);
        if (VIRTUAL_BURN_ADDRESS.getTokenBalance() < collateralTokens) revert InsufficientTokenReserves();

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
        uint256 interestRate = Math.mulDiv(0.039e18, _days, 365) + 0.001e18;
        return Math.mulDiv(_amount, interestRate, 1e18);
    }

    function borrowAgainstCollateral(uint256 _ethAmount, uint256 _days) external nonReentrant {
        if (_days >= MAX_DAYS + 1) revert MaximumDaysExceeded();
        if (_ethAmount == 0) revert InsufficientAmount();

        if (isPositionExpired(msg.sender)) {
            LoanPosition memory expiredLoan = userLoanPositions[msg.sender];
            updateLoanData(expiredLoan.borrowedAmount, expiredLoan.collateralAmount, expiredLoan.expirationDate, false);
            BTB_TOKEN.transfer(address(VIRTUAL_BURN_ADDRESS), expiredLoan.collateralAmount);
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


        LoanPosition memory userPosition = userLoanPositions[msg.sender];

        uint256 todayStart = getDayStartTimestamp(block.timestamp);
        uint256 remainingDays = (userPosition.expirationDate - todayStart) / 1 days;
        uint256 interestCost = getInterestCost(_ethAmount, remainingDays);

        uint256 requiredCollateral = calculateETHtoTokensViewCeil(_ethAmount);
        uint256 borrowedInTokens = calculateETHtoTokensView(userPosition.borrowedAmount);


        uint256 collateralValue = (userPosition.collateralAmount * 99) / 100;
        uint256 additionalCollateralNeeded = requiredCollateral > (collateralValue - borrowedInTokens)
            ? requiredCollateral - (collateralValue - borrowedInTokens)
            : 0;

        uint256 protocolFee = (interestCost * 3) / 10;
        uint256 netBorrowAmount = (_ethAmount * 99) / 100;


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

        if (
            userLoanPositions[msg.sender].borrowedAmount
                > (calculateTokensToETH(currentCollateral - _amount) * 99) / 100
        ) {
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

    function processLiquidations() public {
        uint256 totalBorrowed;
        uint256 totalCollateral;
        uint256 liquidationCount = 0;
        uint256 batchesProcessed = 0;
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
        emit ProtocolTotalsUpdated(totalCollateralAmount, totalBorrowedAmount, lastLiquidationTimestamp);
    }

    function batchLiquidateUsers(address[] calldata _users) external {
        uint256 length = _users.length;
        if (length == 0) return;
        if (length > MAX_BATCH_LIQUIDATIONS) revert TooManyUsers();
        uint256 liquidatedCount = 0;
        uint256 totalCollateralLiquidated = 0;
        address[] memory liquidatedUsers = new address[](length);
        for (uint256 i = 0; i < length;) {
            address user = _users[i];
            if (userLoanPositions[user].borrowedAmount > 0 && userLoanPositions[user].expirationDate < block.timestamp) {
                uint256 userCollateral = userLoanPositions[user].collateralAmount;
                uint256 userBorrowed = userLoanPositions[user].borrowedAmount;
                uint256 userExpiration = userLoanPositions[user].expirationDate;
                
                totalCollateralLiquidated += userCollateral;
                liquidatedUsers[liquidatedCount] = user;
                
                updateLoanData(userBorrowed, userCollateral, userExpiration, false);
                BTB_TOKEN.transfer(address(VIRTUAL_BURN_ADDRESS), userCollateral);
                
                delete userLoanPositions[user];
                unchecked {
                    ++liquidatedCount;
                }
            }
            unchecked {
                ++i;
            }
        }
        if (liquidatedCount > 0) {
            address[] memory actualLiquidated = new address[](liquidatedCount);
            for (uint256 i = 0; i < liquidatedCount;) {
                actualLiquidated[i] = liquidatedUsers[i];
                unchecked {
                    ++i;
                }
            }
            emit BatchLiquidation(liquidatedCount, totalCollateralLiquidated, actualLiquidated);
        }
    }

    function updateLoanData(uint256 _borrowed, uint256 _collateral, uint256 _date, bool _isAdd) private {
        if (_isAdd) {
            dailyCollateralAmounts[_date] += _collateral;
            dailyBorrowedAmounts[_date] += _borrowed;
            totalBorrowedAmount += _borrowed;
            totalCollateralAmount += _collateral;
        } else {

            if (dailyCollateralAmounts[_date] < _collateral) revert CollateralUnderflow();
            if (dailyBorrowedAmounts[_date] < _borrowed) revert BorrowedUnderflow();
            if (totalBorrowedAmount < _borrowed) revert TotalBorrowedUnderflow();
            if (totalCollateralAmount < _collateral) revert TotalCollateralUnderflow();

            dailyCollateralAmounts[_date] -= _collateral;
            dailyBorrowedAmounts[_date] -= _borrowed;
            totalBorrowedAmount -= _borrowed;
            totalCollateralAmount -= _collateral;
        }

        emit LoanDataUpdated(
            dailyCollateralAmounts[_date], dailyBorrowedAmounts[_date], totalBorrowedAmount, totalCollateralAmount
        );
    }


    function getDayStartTimestamp(uint256 _timestamp) public pure returns (uint256) {
        unchecked {
            uint256 dayStart = _timestamp - (_timestamp % SECONDS_PER_DAY);
            return dayStart + 1 days;
        }
    }

    function getExpiringLoans(uint256 _date) external view returns (uint256, uint256) {
        return (dailyBorrowedAmounts[getDayStartTimestamp(_date)], dailyCollateralAmounts[getDayStartTimestamp(_date)]);
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
        unchecked {
            return address(this).balance + totalBorrowedAmount;
        }
    }

    function getEffectiveSupply() public view returns (uint256) {

        unchecked {
            return BTB_TOKEN.totalSupply() - VIRTUAL_BURN_ADDRESS.getTokenBalance();
        }
    }

    function performSafetyCheck(uint256 _ethVolume) private {
        uint256 backing = getProtocolBacking();
        uint256 supply = getEffectiveSupply();
        uint256 newPrice;
        unchecked {
            newPrice = (backing * 1 ether) / supply;
        }
        uint256 contractBalance = BTB_TOKEN.balanceOf(address(this));
        if (contractBalance < totalCollateralAmount) revert InsufficientContractBalance();
        if (newPrice + PRICE_ROUNDING_TOLERANCE < currentPrice) revert PriceCannotDecrease();
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

        return Math.mulDiv(_ethAmount, getEffectiveSupply(), backing);
    }

    function transferETH(address _recipient, uint256 _amount) internal {
        (bool success,) = _recipient.call{value: _amount}("");
        if (!success) revert ETHTransferFailed();
        emit ETHTransferred(_recipient, _amount);
    }

    function estimatePurchaseTokens(uint256 _ethAmount) external view returns (uint256) {

        return Math.mulDiv(_ethAmount * getEffectiveSupply(), purchaseFeePercentage, getProtocolBacking() * PRECISION);
    }


    function getLoopOutput(uint256 _ethAmount, uint256 _numberOfDays)
        external
        view
        returns (uint256 tokens, uint256 totalRequired)
    {
        (uint256 loopFee,, uint256 overCollat, uint256 interest) = calculateLoopParameters(_ethAmount, _numberOfDays);
        totalRequired = overCollat + loopFee + interest;

        uint256 userETH = _ethAmount - loopFee;
        tokens = previewLoopMint(userETH, totalRequired);
    }

    function calculateInverseLoop(uint256 _totalRequired, uint256 _numberOfDays) external view returns (uint256 ethAmount) {
        uint256 low = _totalRequired / 100;
        uint256 high = _totalRequired * 5;
        unchecked {
            while (low < high) {
                uint256 mid = (low + high + 1) / 2;
                (uint256 loopFee,, uint256 overCollat, uint256 interest) = calculateLoopParameters(mid, _numberOfDays);
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


    function getLoopFeePercentage() external view returns (uint16) {
        return loopFeePercentage;
    }


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

    function getFreeCollateral(address _user) public view returns (uint256) {
        if (isPositionExpired(_user)) {
            return 0;
        }
        uint256 userCollateral = userLoanPositions[_user].collateralAmount;
        uint256 userBorrowed = userLoanPositions[_user].borrowedAmount;
        if (userCollateral == 0 || userBorrowed == 0) {
            return 0;
        }
        uint256 userBorrowedInTokens = calculateETHtoTokensViewCeil(userBorrowed);
        uint256 requiredCollateral = (userBorrowedInTokens * PRECISION) / COLLATERAL_RATIO;
        return userCollateral > requiredCollateral ? userCollateral - requiredCollateral : 0;
    }


    function canUserLoop(address _user) external view returns (bool canLoop, string memory reason) {
        LoanPosition memory position = userLoanPositions[_user];
        if (position.borrowedAmount > 0 && !isPositionExpired(_user)) {
            return (false, "Existing position must be closed first");
        }

        return (true, "");
    }


    function getDeploymentInfo() external view returns (uint256 deploymentTime, uint256 deploymentBlock) {
        return (DEPLOYMENT_TIMESTAMP, DEPLOYMENT_BLOCK_NUMBER);
    }


    function verifyBTBTokenSafety() external view returns (bool isSafe, string memory summary) {
        isSafe = VIRTUAL_BURN_ADDRESS.isTokenSafe();
        summary = VIRTUAL_BURN_ADDRESS.getTokenSafetySummary();
    }


    function getProtocolStats()
        external
        view
        returns (
            uint256 backing,
            uint256 effectiveSupply,
            uint256 price,
            uint256 totalBorrowed,
            uint256 totalCollateral,
            bool isActive
        )
    {
        backing = getProtocolBacking();
        effectiveSupply = getEffectiveSupply();
        price = currentPrice;
        totalBorrowed = totalBorrowedAmount;
        totalCollateral = totalCollateralAmount;
        isActive = protocolActive;
    }


    function getPriceRoundingTolerance() external pure returns (uint256 tolerance) {
        return PRICE_ROUNDING_TOLERANCE;
    }

    receive() external payable {}
    fallback() external payable {}
}