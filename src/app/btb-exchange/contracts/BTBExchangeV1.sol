// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract BTBExchangeV1 is Ownable(msg.sender), ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Address for address;

    IERC20 public immutable token;
    IERC20 public immutable usdc;
    IERC20 public btbToken;
    address public adminAddress;
    uint256 public constant PRECISION = 1e6;
    uint256 public constant TOKEN_PRECISION = 1e18;
    
    uint256 public usdcBorrowed;
    uint256 public buyFee = 30;
    uint256 public sellFee = 30;
    uint256 public adminFee = 10;
    uint256 public constant FEE_PRECISION = 10000;
    uint256 public lastTradeBlock;
    uint256 public constant MIN_PRICE = 10000;
    uint256 public constant MIN_EFFECTIVE_CIRCULATION = 1e16;
    uint256 public constant MAX_INITIAL_PRICE = 100000;

    uint256 public constant BASE_TOKEN_REQUIREMENT = 3000 * 1e18;
    
    mapping(address => uint256) public userTradeCounts;
    mapping(address => uint256) public userLastTradeTime;
    
    mapping(address => uint256) public btbDeposits;
    mapping(address => uint256) public lockedBTB;
    mapping(address => uint256) public lockReleaseTime;

    event FeesUpdated(uint256 newBuyFee, uint256 newSellFee, uint256 newAdminFee);
    event AdminAddressUpdated(address indexed newAdmin);
    event TokensWithdrawn(address indexed token, uint256 amount);
    event UsdcBorrowed(uint256 amount, uint256 totalBorrowed);
    event UsdcRepaid(uint256 amount, uint256 remainingBorrowed);
    event TokensBought(address indexed buyer, uint256 usdcAmount, uint256 tokenAmount, uint256 totalFeePercent);
    event TokensSold(address indexed seller, uint256 tokenAmount, uint256 usdcAmount, uint256 totalFeePercent);
    event TradeCountUpdated(address indexed user, uint256 count);
    event TradeCountReset(address indexed user);
    event BTBTokenUpdated(address indexed newBTBToken);
    event BTBDeposited(address indexed user, uint256 amount);
    event BTBWithdrawn(address indexed user, uint256 amount);
    event BTBLocked(address indexed user, uint256 amount, uint256 releaseTime);
    event BTBUnlocked(address indexed user, uint256 amount);

    error SameBlockTrade();
    error PriceBelowMinimum();
    error InsufficientReserve();
    error InvalidAmount();
    error TransferFailed();
    error InsufficientTokenDeposit(uint256 required, uint256 actual);
    error BTBStillLocked(uint256 releaseTime);
    error InsufficientUnlockedBTB(uint256 requested, uint256 available);

    constructor(
        address _token,
        address _usdc,
        address _adminAddress,
        address _btbToken
    ) {
        require(_token != address(0), "Invalid token address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_adminAddress != address(0), "Invalid admin address");
        require(_btbToken != address(0), "Invalid BTB token address");

        token = IERC20(_token);
        usdc = IERC20(_usdc);
        btbToken = IERC20(_btbToken);
        adminAddress = _adminAddress;
        usdcBorrowed = 0;
        _transferOwnership(msg.sender);
    }

    function depositBTB(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        
        btbToken.safeTransferFrom(msg.sender, address(this), amount);
        btbDeposits[msg.sender] += amount;
        
        emit BTBDeposited(msg.sender, amount);
    }
    
    function withdrawBTB(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        
        uint256 availableAmount = getAvailableBTB(msg.sender);
        if (amount > availableAmount) revert InsufficientUnlockedBTB(amount, availableAmount);
        
        btbDeposits[msg.sender] -= amount;
        btbToken.safeTransfer(msg.sender, amount);
        
        emit BTBWithdrawn(msg.sender, amount);
    }

    function unlockBTB() external nonReentrant {
        if(block.timestamp < lockReleaseTime[msg.sender]) revert BTBStillLocked(lockReleaseTime[msg.sender]);
        
        uint256 amountToUnlock = lockedBTB[msg.sender];
        lockedBTB[msg.sender] = 0;
        
        emit BTBUnlocked(msg.sender, amountToUnlock);
    }

    function getCurrentDayStartTimestamp() public view returns (uint256) {
        uint256 currentTimestamp = block.timestamp;
        uint256 daysSinceEpoch = currentTimestamp / 86400;
        return daysSinceEpoch * 86400;
    }

    function getCurrentPrice() public view returns (uint256) {
        uint256 totalSupply = token.totalSupply();
        uint256 contractTokenBalance = token.balanceOf(address(this));
        
        uint256 circulatingSupply = totalSupply > contractTokenBalance ? 
                                   totalSupply - contractTokenBalance : 0;
        
        if (circulatingSupply == 0) {
            return MIN_PRICE;
        }
        
        uint256 effectiveUsdcBalance = usdc.balanceOf(address(this)) + usdcBorrowed;
        
        uint256 effectiveCirculation = circulatingSupply;
        if (circulatingSupply < MIN_EFFECTIVE_CIRCULATION) {
            effectiveCirculation = MIN_EFFECTIVE_CIRCULATION;
        }
        
        uint256 calculatedPrice = (effectiveUsdcBalance * TOKEN_PRECISION) / effectiveCirculation;
        
        if (calculatedPrice < MIN_PRICE) {
            return MIN_PRICE;
        }
        
        return calculatedPrice;
    }

    function getAvailableBTB(address user) public view returns (uint256) {
        return btbDeposits[user] - lockedBTB[user];
    }
}