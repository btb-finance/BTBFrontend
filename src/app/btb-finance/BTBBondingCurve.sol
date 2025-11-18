// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BTBBondingCurve
 * @author BTB Finance Team
 * @notice Dynamic bonding curve for BTB token with market-based pricing
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 DEPLOYMENT INFO - Base Mainnet (Chain ID: 8453)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Implementation: 0x5CF42aAaCfc9c6e8863F7B06C21031cA9E10Ed8E
 * Proxy (Vanity):  0x88888E2Dbd96cC16BD8f52D1de0eCCF2252562d6
 * ProxyAdmin:      0x6552066a0582325ecbb25c25d0818a132cd0856f
 *
 * BaseScan: https://basescan.org/address/0x88888E2Dbd96cC16BD8f52D1de0eCCF2252562d6
 *
 * Deployed via CREATE3Factory for deterministic vanity address
 * Salt: 2080441
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 UPGRADE INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * To upgrade this contract:
 *
 * 1. Deploy new implementation:
 *    forge create src/BTBBondingCurve.sol:BTBBondingCurve \
 *      --constructor-args <BTB_TOKEN> <TREASURY> <FEE_BPS> \
 *      --rpc-url https://mainnet.base.org \
 *      --private-key $PRIVATE_KEY
 *
 * 2. Upgrade via ProxyAdmin:
 *    cast send 0x6552066a0582325ecbb25c25d0818a132cd0856f \
 *      "upgradeAndCall(address,address,bytes)" \
 *      0x88888E2Dbd96cC16BD8f52D1de0eCCF2252562d6 \
 *      <NEW_IMPLEMENTATION> \
 *      0x \
 *      --rpc-url https://mainnet.base.org \
 *      --private-key $PRIVATE_KEY
 *
 * 3. Verify new implementation on BaseScan
 *
 * Current Owner: 0x888888A7182fb3C2D11e9bDED82C5143f48A1847
 * ProxyAdmin Owner: 0x888888A7182fb3C2D11e9bDED82C5143f48A1847
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌐 CONNECT WITH US
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Twitter/X: https://x.com/btb_finance
 * Telegram:  https://t.me/BTBFinance
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📜 OPEN SOURCE - FREE TO USE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Everyone is free to copy and use this code! We believe in open innovation.
 *
 * If you see room for improvement, please share your ideas with us at:
 * - Twitter: https://x.com/btb_finance
 * - Telegram: https://t.me/BTBFinance
 *
 * We want to learn from your improvements so we can grow together! 🚀
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @dev Price increases as circulating supply increases
 *
 * Key Features:
 * - Buy BTB with ETH at current market price
 * - Sell BTB for ETH at current market price
 * - Price = (Contract ETH Balance) / (Circulating Supply)
 * - Circulating Supply = Total Supply - Treasury Balance - Bonding Curve Balance
 * - Trading fees stay in contract as ETH backing (increases price over time)
 * - Receives admin fees from BTBMining contract
 * - Upgradeable via TransparentUpgradeableProxy pattern
 */
contract BTBBondingCurve is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice BTB token contract
    IERC20 public btbToken;

    /// @notice Treasury address holding unminted tokens
    address public treasuryAddress;

    /// @notice Initialization flag for proxy
    bool private initialized;

    /// @notice Total BTB supply (constant)
    uint256 public constant TOTAL_SUPPLY = 88_888_888_888 * 10**18;

    /// @notice Fee percentage on buys/sells (in basis points, e.g., 1000 = 10%)
    uint256 public tradingFeeBps;
    uint256 public constant BPS_DENOMINATOR = 10000;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event BTBBought(address indexed buyer, uint256 ethAmount, uint256 btbAmount, uint256 price);
    event BTBSold(address indexed seller, uint256 btbAmount, uint256 ethAmount, uint256 price);
    event AdminFeesReceived(uint256 amount);
    event TreasuryAddressSet(address indexed oldTreasury, address indexed newTreasury);
    event TradingFeeUpdated(uint256 newFeeBps);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InsufficientETH();
    error InsufficientBTB();
    error InsufficientContractBalance();
    error InvalidAmount();
    error TransferFailed();
    error InvalidParameters();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _btbToken,
        address _treasuryAddress,
        uint256 _tradingFeeBps
    ) Ownable(msg.sender) {
        require(_btbToken != address(0), "Invalid BTB token");
        require(_treasuryAddress != address(0), "Invalid treasury");
        require(_tradingFeeBps < BPS_DENOMINATOR, "Invalid fee");

        btbToken = IERC20(_btbToken);
        treasuryAddress = _treasuryAddress;
        tradingFeeBps = _tradingFeeBps;
    }

    /**
     * @notice Initialize the contract (for proxy deployments)
     * @param _owner Owner address
     * @param _btbToken BTB token address
     * @param _treasuryAddress Treasury address
     * @param _tradingFeeBps Trading fee in basis points
     */
    function initialize(
        address _owner,
        address _btbToken,
        address _treasuryAddress,
        uint256 _tradingFeeBps
    ) external {
        require(!initialized, "Already initialized");
        require(_owner != address(0), "Invalid owner");
        require(_btbToken != address(0), "Invalid BTB token");
        require(_treasuryAddress != address(0), "Invalid treasury");
        require(_tradingFeeBps < BPS_DENOMINATOR, "Invalid fee");

        initialized = true;
        _transferOwnership(_owner);

        btbToken = IERC20(_btbToken);
        treasuryAddress = _treasuryAddress;
        tradingFeeBps = _tradingFeeBps;
    }

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Buy BTB tokens with ETH at current market price
     * @dev Trading fee stays in contract as backing, increasing price over time
     */
    function buy() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        uint256 fee = (msg.value * tradingFeeBps) / BPS_DENOMINATOR;
        uint256 ethAfterFee = msg.value - fee;

        uint256 price = getCurrentPrice();
        uint256 btbAmount = (ethAfterFee * 10**18) / price;

        uint256 contractBTB = btbToken.balanceOf(address(this));
        if (contractBTB < btbAmount) revert InsufficientContractBalance();

        btbToken.safeTransfer(msg.sender, btbAmount);

        emit BTBBought(msg.sender, msg.value, btbAmount, price);
    }

    /**
     * @notice Sell BTB tokens for ETH at current market price
     * @param btbAmount Amount of BTB to sell
     * @dev Trading fee stays in contract as backing, increasing price over time
     */
    function sell(uint256 btbAmount) external nonReentrant {
        if (btbAmount == 0) revert InvalidAmount();

        uint256 price = getCurrentPrice();
        uint256 ethAmount = (btbAmount * price) / 10**18;

        uint256 fee = (ethAmount * tradingFeeBps) / BPS_DENOMINATOR;
        uint256 ethAfterFee = ethAmount - fee;

        if (address(this).balance < ethAfterFee) revert InsufficientContractBalance();

        btbToken.safeTransferFrom(msg.sender, address(this), btbAmount);

        (bool success, ) = msg.sender.call{value: ethAfterFee}("");
        if (!success) revert TransferFailed();

        emit BTBSold(msg.sender, btbAmount, ethAfterFee, price);
    }

    /*//////////////////////////////////////////////////////////////
                          PRICE CALCULATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get current BTB price based on circulating supply
     * @dev Price = (Contract ETH Balance * 10^18) / Circulating Supply
     * @return price Current price in wei per 1 BTB token
     */
    function getCurrentPrice() public view returns (uint256 price) {
        uint256 ethReserve = getETHReserve();
        uint256 circulatingSupply = getCirculatingSupply();

        if (circulatingSupply == 0) {
            return 0;
        }

        price = (ethReserve * 10**18) / circulatingSupply;
    }

    /**
     * @notice Get total ETH backing (includes trading fees)
     * @return Total ETH in contract
     */
    function getETHReserve() public view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get BTB tokens available for trading
     * @return Contract BTB balance
     */
    function getBTBReserve() public view returns (uint256) {
        return btbToken.balanceOf(address(this));
    }

    /**
     * @notice Calculate circulating supply
     * @return Circulating supply (Total - Treasury - Bonding Curve)
     * @dev Only user-held tokens count as circulating
     */
    function getCirculatingSupply() public view returns (uint256) {
        uint256 treasuryBalance = btbToken.balanceOf(treasuryAddress);
        uint256 bondingCurveBalance = btbToken.balanceOf(address(this));
        return TOTAL_SUPPLY - treasuryBalance - bondingCurveBalance;
    }

    /**
     * @notice Preview buy transaction
     * @param ethAmount ETH amount to spend
     * @return btbAmount BTB you'll receive
     * @return price Current price
     * @return fee Trading fee
     */
    function previewBuy(uint256 ethAmount) external view returns (uint256 btbAmount, uint256 price, uint256 fee) {
        price = getCurrentPrice();
        fee = (ethAmount * tradingFeeBps) / BPS_DENOMINATOR;
        uint256 ethAfterFee = ethAmount - fee;
        btbAmount = (ethAfterFee * 10**18) / price;
    }

    /**
     * @notice Preview sell transaction
     * @param btbAmount BTB amount to sell
     * @return ethAmount ETH you'll receive
     * @return price Current price
     * @return fee Trading fee
     */
    function previewSell(uint256 btbAmount) external view returns (uint256 ethAmount, uint256 price, uint256 fee) {
        price = getCurrentPrice();
        uint256 ethBeforeFee = (btbAmount * price) / 10**18;
        fee = (ethBeforeFee * tradingFeeBps) / BPS_DENOMINATOR;
        ethAmount = ethBeforeFee - fee;
    }

    /*//////////////////////////////////////////////////////////////
                          ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set treasury address for circulating supply calculation
     * @param _treasuryAddress New treasury address
     */
    function setTreasuryAddress(address _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        address oldTreasury = treasuryAddress;
        treasuryAddress = _treasuryAddress;
        emit TreasuryAddressSet(oldTreasury, _treasuryAddress);
    }

    /**
     * @notice Update trading fee
     * @param _tradingFeeBps New fee in basis points (e.g., 1000 = 10%)
     */
    function setTradingFee(uint256 _tradingFeeBps) external onlyOwner {
        require(_tradingFeeBps < BPS_DENOMINATOR, "Invalid fee");
        tradingFeeBps = _tradingFeeBps;
        emit TradingFeeUpdated(_tradingFeeBps);
    }

    /**
     * @notice Emergency withdraw BTB tokens
     * @param recipient Address to receive tokens
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawBTB(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        btbToken.safeTransfer(recipient, amount);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get available ETH for backing
     */
    function getAvailableETH() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get available BTB for trading
     */
    function getAvailableBTB() external view returns (uint256) {
        return btbToken.balanceOf(address(this));
    }

    /**
     * @notice Get comprehensive market information
     */
    function getMarketInfo() external view returns (
        uint256 currentPrice,
        uint256 circulatingSupply,
        uint256 ethBacking,
        uint256 availableBTB,
        uint256 tradingFee
    ) {
        currentPrice = getCurrentPrice();
        circulatingSupply = getCirculatingSupply();
        ethBacking = address(this).balance;
        availableBTB = btbToken.balanceOf(address(this));
        tradingFee = tradingFeeBps;
    }

    /*//////////////////////////////////////////////////////////////
                          RECEIVE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        emit AdminFeesReceived(msg.value);
    }
}