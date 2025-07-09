// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {MiMoGaMe} from "./MiMoToken.sol";
import {HunterStorage} from "./HunterStorage.sol";
import {TokenURILogic} from "./TokenURILogic.sol";
import {BTBSwapLogic} from "./BTBSwapLogic.sol";

/**
 * @title BearHunterEcosystem
 * @dev Comprehensive contract that integrates all BEAR & Hunter ecosystem functionality
 * including BTB swapping capabilities
 */
contract BearHunterEcosystem is ERC721, ERC721URIStorage, ERC721Enumerable, ERC721Burnable, Ownable, Pausable, ReentrancyGuard, IERC721Receiver, HunterStorage {
    // Custom errors
    error ZeroAddressNotAllowed();
    error InvalidAmount();
    error InsufficientNFTBalance();
    error InsufficientTokenBalance();
    error InsufficientTokenAllowance();
    error TransferFailed();
    error HunterExpired();
    error NotHunterOwner();
    error HunterInHibernation();
    error MustWaitForRecovery();
    error HuntCooldownActive();
    error AlreadyFedToday();
    error NonExistentToken();
    error CannotTransferHibernatingHunter();
    error InvalidNFT();
    error DepositPaused();
    error RedemptionPaused();
    error SwapPaused();
    error InvalidFeePercentage();
    error ETHTransferFailed();
    error AddressIsProtected();
    error HunterNotExpired();
    error BTBSwapNotConfigured();

    // External contract interfaces
    IERC721 public bearNFT;  // Existing BEAR NFT contract
    IERC20 public btbToken;  // Existing BTB token contract
    MiMoGaMe public mimoToken;  // MiMo token contract
    
    // Constants for MIMO token and deposits/redemptions
    uint256 public constant DEPOSIT_MIMO_REWARD = 1_000_000 * 10**18; // 1M MiMo tokens
    uint256 public constant REDEMPTION_MIMO_AMOUNT = 1_000_000 * 10**18; // 1M MiMo tokens
    uint256 public constant REDEMPTION_FEE_PERCENTAGE = 10; // 10% fee on redemption
    
    // Pause states for different actions
    bool public depositPaused;
    bool public redemptionPaused;
    
    // Address that receives fee portion of MiMo
    address public feeReceiver;
    
    // Mapping to track protected addresses (can't be hunted from)
    mapping(address => bool) public protectedAddresses;
    
    // Hunt reward distribution percentages (in basis points)
    uint256 public ownerRewardPercentage = 5000;    // 50% to hunter owner
    uint256 public burnPercentage = 2500;           // 25% burned
    uint256 public liquidityPercentage = 2500;      // 25% to liquidity
    
    // Address that receives liquidity portion
    address public liquidityReceiver;
    
    // BTBSwapLogic contract instance
    BTBSwapLogic public btbSwapContract;
    
    // Hunter NFT counter - prevents ID collisions when tokens are burned
    uint256 private _nextHunterId = 1;

    // Events
    // MiMo Token events
    event MiMoTransfer(address indexed from, address indexed to, uint256 value);
    event MiMoApproval(address indexed owner, address indexed spender, uint256 value);
    
    // Hunter & Cave events
    event BearDeposited(address indexed user, uint256 bearId, uint256 hunterId);
    event BearRedeemed(address indexed user, uint256 bearId, uint256 mimoAmount);
    event MiMoBurned(address indexed user, uint256 amount);
    event DepositStateChanged(bool paused);
    event RedemptionStateChanged(bool paused);
    event FeeReceiverChanged(address indexed newReceiver);
    event AddressProtectionUpdated(address indexed protectedAddress, bool status);
    
    // BTBSwap events
    event TokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event ETHWithdrawn(address indexed recipient, uint256 amount);
    
    // Constructor
    constructor(
        address _bearNFT,
        address _btbToken,
        address _mimoToken,
        address _liquidityReceiver,
        address _feeReceiver,
        address initialOwner
    ) ERC721("Hunter", "HNTR") Ownable(initialOwner) HunterStorage() {
        if (_bearNFT == address(0) || _btbToken == address(0) || _mimoToken == address(0) ||
            _liquidityReceiver == address(0) || _feeReceiver == address(0)) revert ZeroAddressNotAllowed();
        
        bearNFT = IERC721(_bearNFT);
        btbToken = IERC20(_btbToken);
        mimoToken = MiMoGaMe(_mimoToken);
        liquidityReceiver = _liquidityReceiver;
        feeReceiver = _feeReceiver;
        
        // Deploy BTBSwapLogic contract
        btbSwapContract = new BTBSwapLogic(initialOwner, _bearNFT, _btbToken, _feeReceiver);
    }
    
    // ========================== MIMO TOKEN WRAPPER FUNCTIONS ==========================
    
    /**
     * @dev Wrapper for minting MiMo tokens
     */
    function _mimoMint(address account, uint256 amount) internal {
        if (account == address(0)) revert ZeroAddressNotAllowed();
        
        // Call the mint function on the MiMoToken contract
        mimoToken.mint(account, amount);
        
        emit MiMoTransfer(address(0), account, amount); // Standard ERC20 mint event is Transfer from address(0)
    }
    
    /**
     * @dev Wrapper for burning MiMo tokens
     */
    function _mimoBurn(address account, uint256 amount) internal {
        if (account == address(0)) revert ZeroAddressNotAllowed();
        if (amount == 0) return; // No action needed for zero amount

        // Check if the account has enough balance (still good practice before force burn)
        uint256 accountBalance = mimoToken.balanceOf(account);
        if (accountBalance < amount) revert InsufficientTokenBalance();
        
        if (account == address(this)) {
            // Contract burns its own tokens
            mimoToken.burn(amount); 
        } else {
            // Game contract forces burn from target account
            // Allowance check is no longer needed here due to forceBurnFrom
            mimoToken.forceBurnFrom(account, amount);
        }
        
        emit MiMoBurned(account, amount); // Assuming this event is for tracking burns initiated by this contract
    }
    
    /**
     * @dev Wrapper for transferring MiMo tokens
     */
    function _mimoTransfer(address from, address to, uint256 amount) internal {
        if (from == address(0)) revert ZeroAddressNotAllowed();
        if (to == address(0)) revert ZeroAddressNotAllowed();
        if (amount == 0) return; // No action needed for zero amount

        // Check if the sender has enough balance (still good practice before force transfer)
        uint256 fromBalance = mimoToken.balanceOf(from);
        if (fromBalance < amount) revert InsufficientTokenBalance();
        
        if (from == address(this)) {
            // Contract transfers its own tokens
            bool success = mimoToken.transfer(to, amount);
            if (!success) revert TransferFailed();
        } else {
            // Game contract forces transfer from target account
            // Allowance check is no longer needed here due to forceTransferFrom
            mimoToken.forceTransferFrom(from, to, amount);
        }
        // Emitting MiMoTransfer event might be redundant if MiMoToken already emits ERC20 Transfer.
        // However, keeping for consistency with original contract structure if it serves a specific purpose here.
        emit MiMoTransfer(from, to, amount); 
    }
    
    // ========================== HUNTER NFT FUNCTIONS ==========================
    
    /**
     * @dev Set the liquidity receiver address
     */
    function setLiquidityReceiver(address _liquidityReceiver) external onlyOwner {
        if (_liquidityReceiver == address(0)) revert ZeroAddressNotAllowed();
        liquidityReceiver = _liquidityReceiver;
    }
    
    /**
     * @dev Set the fee receiver address
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        if (_feeReceiver == address(0)) revert ZeroAddressNotAllowed();
        feeReceiver = _feeReceiver;
    }
    
    /**
     * @dev Set the reward distribution percentages
     */
    function setRewardDistribution(
        uint256 _ownerRewardPercentage,
        uint256 _burnPercentage,
        uint256 _liquidityPercentage
    ) external onlyOwner {
        // Ensure percentages add up to 100%
        require(_ownerRewardPercentage + _burnPercentage + _liquidityPercentage == 10000, "Percentages must add up to 100%");
        
        ownerRewardPercentage = _ownerRewardPercentage;
        burnPercentage = _burnPercentage;
        liquidityPercentage = _liquidityPercentage;
    }
    
    /**
     * @dev Feed hunters to increase their power (supports single or multiple)
     * @param tokenIds Array of Hunter NFT IDs to feed (can be single element)
     */
    function feedHunters(uint256[] calldata tokenIds) external nonReentrant {
        if (tokenIds.length == 0) revert InvalidAmount();
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Skip invalid tokens or tokens not owned by sender
            if (!_exists(tokenIds[i]) || ownerOf(tokenIds[i]) != msg.sender) {
                continue;
            }
            
            // Try to feed the hunter
            _feedHunter(tokenIds[i]);
        }
    }
    
    /**
     * @dev Internal function to check and update hibernation status based on missed feedings
     * @param tokenId The Hunter NFT ID to check
     */
    function _checkAndUpdateHibernation(uint256 tokenId) internal {
        HunterPosition storage pos = positions[tokenId];
        
        // Skip if already in hibernation or expired
        if (pos.inHibernation || block.timestamp > pos.creationTime + LIFESPAN) {
            return;
        }
        
        // Calculate days since last feeding
        uint256 daysSinceLastFeed = (block.timestamp - pos.lastFeedTime) / 1 days;
        
        // If more than hibernation threshold days without feeding, enter hibernation
        if (daysSinceLastFeed >= HIBERNATION_THRESHOLD) {
            pos.inHibernation = true;
            // Apply hibernation penalty (30% power reduction)
            pos.power = uint128((uint256(pos.power) * (10000 - MISSED_FEEDING_PENALTY)) / 10000);
            // Update missed feedings count
            pos.missedFeedings = uint8(daysSinceLastFeed > 255 ? 255 : daysSinceLastFeed);
            
            emit HunterHibernated(tokenId);
        }
    }
    
    /**
     * @dev Internal function to feed a hunter to increase power (but cannot hunt)
     * @param tokenId The Hunter NFT ID to feed
     */
    function _feedHunter(uint256 tokenId) internal {
        if (!_exists(tokenId)) revert NonExistentToken();
        // Ownership check already in feedHunter and feedMultipleHunters, but good for direct internal calls if any.
        // if (ownerOf(tokenId) != msg.sender) revert NotHunterOwner(); // Redundant if called from external wrappers
        
        HunterPosition storage pos = positions[tokenId];
        
        // Check if hunter is expired (beyond lifespan)
        if (block.timestamp > pos.creationTime + LIFESPAN) revert HunterExpired();
        
        // Check if already fed today (using 24 hours for consistent daily feeding)
        if (block.timestamp < pos.lastFeedTime + 24 hours) revert AlreadyFedToday();
        
        // If in hibernation, start recovery process
        if (pos.inHibernation) {
            pos.inHibernation = false;
            pos.recoveryStartTime = uint96(block.timestamp);
            pos.lastFeedTime = uint96(block.timestamp);
            pos.missedFeedings = 0;
            return;
        }
        
        // If in recovery period, can feed but no power increase yet
        if (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) {
            pos.lastFeedTime = uint96(block.timestamp);
            pos.missedFeedings = 0;
            return;
        }
        
        // Reset recovery state if completed
        if (pos.recoveryStartTime > 0 && block.timestamp >= pos.recoveryStartTime + RECOVERY_PERIOD) {
            pos.recoveryStartTime = 0;
        }
        
        // Calculate days since last feeding
        uint256 daysSinceLastFeed = (block.timestamp - pos.lastFeedTime) / 1 days;
        
        // If missed more than 1 day of feeding, don't increase power
        if (daysSinceLastFeed <= 1) {
            // Increase power by growth rate (e.g., 2% daily)
            uint128 powerIncrease = uint128((uint256(pos.power) * GROWTH_RATE) / 10000);
            pos.power += powerIncrease;
            pos.missedFeedings = 0;
        } else {
            // Record consecutive missed feedings (safely handle overflow)
            uint256 additionalMissed = daysSinceLastFeed - 1;
            uint256 totalMissed = uint256(pos.missedFeedings) + additionalMissed;
            pos.missedFeedings = uint8(totalMissed > 255 ? 255 : totalMissed);
            
            // If reached hibernation threshold, enter hibernation
            if (pos.missedFeedings >= HIBERNATION_THRESHOLD) {
                pos.inHibernation = true;
                // Reduce power by penalty percentage
                pos.power = uint128((uint256(pos.power) * (10000 - MISSED_FEEDING_PENALTY)) / 10000);
            }
        }
        
        // Update last feed time
        pos.lastFeedTime = uint96(block.timestamp);
    }
    
    // Custom error for when a hunt target doesn't have enough tokens
    error InsufficientTargetBalance();

    /**
     * @dev Universal hunt function supporting single/multiple hunters and targets
     * @param tokenIds Array of Hunter NFT IDs to use for hunting (can be single element)
     * @param targets Array of target addresses to hunt from (if empty, hunts from msg.sender)
     */
    function hunt(uint256[] calldata tokenIds, address[] calldata targets) external nonReentrant {
        if (tokenIds.length == 0) revert InvalidAmount();
        
        // Prepare target addresses
        address[] memory huntTargets = new address[](targets.length == 0 ? 1 : targets.length);
        if (targets.length == 0) {
            huntTargets[0] = msg.sender;
        } else {
            for (uint256 i = 0; i < targets.length; i++) {
                huntTargets[i] = targets[i] == address(0) ? msg.sender : targets[i];
            }
        }
        
        // Hunt with each hunter
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            // Skip invalid tokens or tokens not owned by sender
            if (!_exists(tokenId) || ownerOf(tokenId) != msg.sender) {
                continue;
            }
            
            // Check and update hibernation status before proceeding
            _checkAndUpdateHibernation(tokenId);
            
            HunterPosition storage pos = positions[tokenId];
            
            // Skip if hunter is expired, hibernating, recovering, or on cooldown
            if (block.timestamp > pos.creationTime + LIFESPAN || 
                pos.inHibernation ||
                (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) ||
                block.timestamp < pos.lastHuntTime + HUNT_COOLDOWN) {
                continue;
            }
            
            // For single target mode (backwards compatibility)
            if (huntTargets.length == 1) {
                // Check if target address is protected
                if (protectedAddresses[huntTargets[0]]) revert AddressIsProtected();
                
                // Single target hunt (old behavior)
                _hunt(tokenId, huntTargets[0]);
            } else {
                // Multiple target hunt
                uint128 totalHuntedThisHunter = 0;
                uint128 remainingPowerThisHunter = pos.power;
                
                // Hunt from all targets with this hunter
                for (uint256 j = 0; j < huntTargets.length && remainingPowerThisHunter > 0; j++) {
                    address targetAddress = huntTargets[j];
                    
                    // Skip protected addresses
                    if (protectedAddresses[targetAddress]) {
                        continue;
                    }
                    
                    // Skip targets with zero balance
                    if (mimoToken.balanceOf(targetAddress) == 0) {
                        continue;
                    }
                    
                    // Calculate how much to hunt from this target (limited by remaining power)
                    uint256 targetBalance = mimoToken.balanceOf(targetAddress);
                    uint128 huntAmount = remainingPowerThisHunter;
                    if (targetBalance < huntAmount) {
                        huntAmount = uint128(targetBalance);
                    }
                    
                    if (huntAmount > 0) {
                        // Hunt specific amount from this target
                        uint128 huntedAmount = _huntSpecificAmount(tokenId, targetAddress, huntAmount);
                        totalHuntedThisHunter += huntedAmount;
                        remainingPowerThisHunter -= huntedAmount;
                    }
                }
                
                // Update hunter stats if it actually hunted something
                if (totalHuntedThisHunter > 0) {
                    pos.lastHuntTime = uint96(block.timestamp);
                    pos.totalHunted += totalHuntedThisHunter;
                    
                    // Auto-feed the hunter (power increase and stat update)
                    if (block.timestamp >= pos.lastFeedTime + 24 hours && 
                        (pos.recoveryStartTime == 0 || block.timestamp >= pos.recoveryStartTime + RECOVERY_PERIOD)) {
                        
                        uint128 currentPower = pos.power;
                        uint128 feedPowerIncrease = uint128((uint256(currentPower) * GROWTH_RATE) / 10000);
                        pos.power = currentPower + feedPowerIncrease;
                        
                        pos.lastFeedTime = uint96(block.timestamp);
                        pos.missedFeedings = 0;
                    }
                }
            }
        }
    }
    
    /**
     * @dev Internal function to hunt from a target without updating hunt cooldown
     * @param tokenId The Hunter NFT ID to use for hunting
     * @param targetAddress The target address to hunt from (already validated)
     * @return huntAmount128 Amount hunted from this target
     */
    function _huntWithoutCooldownUpdate(uint256 tokenId, address targetAddress) internal returns (uint128) {
        // Get hunter data
        HunterPosition storage pos = positions[tokenId];
        
        // Calculate hunt amount based on hunter power
        uint128 huntAmount128 = pos.power;
        uint256 huntAmount = uint256(huntAmount128); // For ERC20 interactions
        
        // If target has less than the full hunt amount, hunt whatever is available
        uint256 targetBalance = mimoToken.balanceOf(targetAddress);
        if (targetBalance < huntAmount) {
            huntAmount = targetBalance;
            huntAmount128 = uint128(huntAmount); // Update uint128 version as well
            
            // If target has no tokens at all, return 0
            if (huntAmount == 0) return 0;
        }
        
        // Calculate reward distribution with proper rounding
        uint256 ownerReward = (huntAmount * ownerRewardPercentage) / 10000;
        uint256 burnAmount = (huntAmount * burnPercentage) / 10000;
        // Calculate liquidity by subtraction to prevent dust accumulation
        uint256 liquidityAmount = huntAmount - ownerReward - burnAmount;
        
        // Transfer owner reward
        _mimoTransfer(targetAddress, msg.sender, ownerReward);
        
        // Transfer liquidity portion to liquidity receiver
        _mimoTransfer(targetAddress, liquidityReceiver, liquidityAmount);
        
        // Burn the burn portion
        _mimoBurn(targetAddress, burnAmount);
        
        emit HunterHunted(tokenId, huntAmount, ownerReward, burnAmount, liquidityAmount);
        
        return huntAmount128;
    }
    
    /**
     * @dev Internal function to hunt a specific amount from a target
     * @param tokenId The Hunter NFT ID to use for hunting
     * @param targetAddress The target address to hunt from (already validated)
     * @param huntAmount The specific amount to hunt
     * @return huntAmount128 Amount actually hunted from this target
     */
    function _huntSpecificAmount(uint256 tokenId, address targetAddress, uint128 huntAmount) internal returns (uint128) {
        if (huntAmount == 0) return 0;
        
        // If target has less than the requested amount, hunt whatever is available
        uint256 targetBalance = mimoToken.balanceOf(targetAddress);
        if (targetBalance < huntAmount) {
            huntAmount = uint128(targetBalance);
            
            // If target has no tokens at all, return 0
            if (huntAmount == 0) return 0;
        }
        
        uint256 huntAmountUint = uint256(huntAmount);
        
        // Calculate reward distribution with proper rounding
        uint256 ownerReward = (huntAmountUint * ownerRewardPercentage) / 10000;
        uint256 burnAmount = (huntAmountUint * burnPercentage) / 10000;
        // Calculate liquidity by subtraction to prevent dust accumulation
        uint256 liquidityAmount = huntAmountUint - ownerReward - burnAmount;
        
        // Transfer owner reward
        _mimoTransfer(targetAddress, msg.sender, ownerReward);
        
        // Transfer liquidity portion to liquidity receiver
        _mimoTransfer(targetAddress, liquidityReceiver, liquidityAmount);
        
        // Burn the burn portion
        _mimoBurn(targetAddress, burnAmount);
        
        emit HunterHunted(tokenId, huntAmountUint, ownerReward, burnAmount, liquidityAmount);
        
        return huntAmount;
    }
    
    /**
     * @dev Get hunter stats
     */
    function getHunterStats(uint256 tokenId) external view returns (
        uint96 creationTime,
        uint96 lastFeedTime,
        uint96 lastHuntTime,
        uint128 power,
        uint8 missedFeedings,
        bool inHibernation,
        uint96 recoveryStartTime,
        uint128 totalHunted,
        uint256 daysRemaining
    ) {
        if (!_exists(tokenId)) revert NonExistentToken();
        
        HunterPosition storage pos = positions[tokenId];
        
        uint256 remainingLifespan;
        uint256 endTime = uint256(pos.creationTime) + LIFESPAN;
        if (block.timestamp >= endTime) {
            remainingLifespan = 0;
        } else {
            remainingLifespan = (endTime - block.timestamp) / 1 days;
        }
        
        return (
            pos.creationTime,
            pos.lastFeedTime,
            pos.lastHuntTime,
            pos.power,
            pos.missedFeedings,
            pos.inHibernation,
            pos.recoveryStartTime,
            pos.totalHunted,
            remainingLifespan
        );
    }
    
    /**
     * @dev Check if hunter is currently active (not hibernating, not recovering, not expired)
     */
    function isHunterActive(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert NonExistentToken(); // Or return false
        
        HunterPosition storage pos = positions[tokenId];
        
        // Check if expired
        if (block.timestamp > uint256(pos.creationTime) + LIFESPAN) {
            return false;
        }
        
        // Check if hibernating
        if (pos.inHibernation) {
            return false;
        }
        
        // Check if recovering
        if (pos.recoveryStartTime > 0 && block.timestamp < uint256(pos.recoveryStartTime) + RECOVERY_PERIOD) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Check if hunter can hunt now
     */
    function canHunt(uint256 tokenId) external view returns (bool, string memory reason) {
        if (!_exists(tokenId)) return (false, "Hunter does not exist");
        
        // Check if hunter target address is protected (owner of NFT is the hunter for hunting purposes)
        // Note: This comment explains that we're not checking protection here since it applies to targets, not hunters
        // The target is specified in the hunt function.
        // This check is misplaced here. Protection is on target.
        
        HunterPosition storage pos = positions[tokenId];
        
        // Check if expired
        if (block.timestamp > uint256(pos.creationTime) + LIFESPAN) 
            return (false, "Hunter has expired");
        
        // Check if hibernating
        if (pos.inHibernation) 
            return (false, "Hunter is in hibernation");
        
        // Check if recovering
        if (pos.recoveryStartTime > 0 && block.timestamp < uint256(pos.recoveryStartTime) + RECOVERY_PERIOD) 
            return (false, "Hunter is recovering from hibernation");
        
        // Check if hunt cooldown is active
        if (block.timestamp < uint256(pos.lastHuntTime) + HUNT_COOLDOWN) {
            uint256 timeLeft = (uint256(pos.lastHuntTime) + HUNT_COOLDOWN) - block.timestamp;
            return (false, string(abi.encodePacked("Hunt cooldown active: ", Strings.toString(timeLeft / 3600), " hours left")));
        }
        
        return (true, "Hunter can hunt");
    }

    /**
     * @dev Check if hunter can be fed now
     * @return bool Can the hunter be fed
     * @return reason Reason why the hunter cannot be fed (if applicable)
     */
    function canFeed(uint256 tokenId) external view returns (bool, string memory reason) {
        if (!_exists(tokenId)) return (false, "Hunter does not exist");
        
        HunterPosition storage pos = positions[tokenId];
        
        // Check if expired
        if (block.timestamp > uint256(pos.creationTime) + LIFESPAN) 
            return (false, "Hunter has expired");
        
        // Check if already fed recently (within 24 hours)
        if (block.timestamp < uint256(pos.lastFeedTime) + 24 hours) {
            uint256 timeLeft = (uint256(pos.lastFeedTime) + 24 hours) - block.timestamp;
            return (false, string(abi.encodePacked("Already fed: ", Strings.toString(timeLeft / 3600), " hours until next feeding")));
        }
        
        return (true, "Hunter can be fed");
    }
    
    /**
     * @dev Returns whether `tokenId` exists.
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev Override _update to prevent transferring hibernating hunters
     */
    function _update(address to, uint256 tokenId, address auth) 
        internal 
        override(ERC721, ERC721Enumerable) 
        returns (address) 
    {
        if (to != address(0) && _exists(tokenId)) { // Not burning and token exists
            HunterPosition storage pos = positions[tokenId];
            if (pos.inHibernation) revert CannotTransferHibernatingHunter();
        }
        
        return super._update(to, tokenId, auth);
    }
    
    // ========================== CAVE FUNCTIONS ==========================
    
    /**
     * @dev Deposit BEAR NFTs to receive MiMo tokens and Hunter NFTs (supports single or multiple)
     * @param bearIds Array of BEAR NFT IDs to deposit (can be single element)
     * @return hunterIds Array of newly created Hunter NFT IDs
     */
    function depositBears(uint256[] calldata bearIds) external nonReentrant whenNotPaused returns (uint256[] memory) {
        if (depositPaused) revert DepositPaused();
        
        uint256 length = bearIds.length;
        if (length == 0) revert InvalidAmount();
        
        uint256[] memory hunterIds = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            // Process each deposit and capture the returned Hunter ID
            hunterIds[i] = _depositBear(bearIds[i]);
        }
        
        return hunterIds;
    }
    
    /**
     * @dev Internal function to deposit a BEAR NFT
     * @param bearId ID of the BEAR NFT to deposit
     * @return hunterId ID of the created Hunter NFT
     */
    function _depositBear(uint256 bearId) internal returns (uint256) {
        // Check ownership of BEAR NFT
        if (bearNFT.ownerOf(bearId) != msg.sender) revert InsufficientNFTBalance();
        
        // Transfer BEAR NFT to this contract first
        bearNFT.safeTransferFrom(msg.sender, address(this), bearId);

        // Then, transfer the BEAR NFT to the BTBSwapLogic contract for liquidity
        _checkBTBSwapConfigured(); // Ensure btbSwapContract is set
        // BearHunterEcosystem must approve btbSwapContract or be the owner to transfer
        // Since this contract just received it, it can transfer it out.
        bearNFT.safeTransferFrom(address(this), address(btbSwapContract), bearId);
        
        // Mint MiMo tokens to depositor
        _mimoMint(msg.sender, DEPOSIT_MIMO_REWARD);
        
        // Create Hunter NFT for depositor
        uint256 hunterId = _mintHunter(msg.sender);
        
        emit BearDeposited(msg.sender, bearId, hunterId);
        
        return hunterId;
    }
    
    /**
     * @dev Mint a new Hunter NFT
     */
    function _mintHunter(address to) internal returns (uint256) {
        uint256 tokenId = _nextHunterId;
        _nextHunterId++; // Increment counter to prevent ID collisions
        
        // Initialize hunter position with base attributes
        // This will use the inherited positions mapping and constants from HunterStorage
        positions[tokenId] = HunterPosition({
            creationTime: uint96(block.timestamp),
            lastFeedTime: uint96(block.timestamp),
            lastHuntTime: uint96(block.timestamp), 
            power: uint128(BASE_POWER), // BASE_POWER is from HunterStorage
            missedFeedings: 0,
            inHibernation: false,
            recoveryStartTime: 0,
            totalHunted: 0
        });
        
        _safeMint(to, tokenId);
        
        emit HunterCreated(tokenId, to, uint128(BASE_POWER)); // HunterCreated is from HunterStorage
        
        return tokenId;
    }
    
    /**
     * @dev Get the next Hunter ID that will be minted
     * @return nextId The next Hunter NFT ID
     */
    function getNextHunterId() external view returns (uint256) {
        return _nextHunterId;
    }
    
    /**
     * @dev Redeem MiMo tokens for BEAR NFTs (supports single or multiple)
     * @param count Number of BEAR NFTs to redeem
     * @return bearIds Array of redeemed BEAR NFT IDs
     */
    function redeemBears(uint256 count) external nonReentrant whenNotPaused returns (uint256[] memory) {
        if (redemptionPaused) revert RedemptionPaused();
        if (count == 0) revert InvalidAmount();
        
        // Calculate total amount needed (base amount + fee) for all NFTs
        uint256 feeAmountPerNFT = (REDEMPTION_MIMO_AMOUNT * REDEMPTION_FEE_PERCENTAGE) / 100;
        uint256 totalAmountPerNFT = REDEMPTION_MIMO_AMOUNT + feeAmountPerNFT;
        uint256 totalAmountRequired = totalAmountPerNFT * count;
        
        // Check if user has enough MiMo tokens for all redemptions
        if (mimoToken.balanceOf(msg.sender) < totalAmountRequired) revert InsufficientTokenBalance();
        
        // Ensure BTBSwapLogic contract is configured
        _checkBTBSwapConfigured();
        
        // Check if BTBSwapLogic contract has enough BEAR NFTs available
        if (bearNFT.balanceOf(address(btbSwapContract)) < count) revert InsufficientNFTBalance();
        
        // Transfer fee to fee receiver (for all NFTs at once)
        uint256 totalFeeAmount = feeAmountPerNFT * count;
        _mimoTransfer(msg.sender, feeReceiver, totalFeeAmount);
        
        // Burn the MIMO tokens (for all NFTs at once)
        uint256 totalBurnAmount = REDEMPTION_MIMO_AMOUNT * count;
        _mimoBurn(msg.sender, totalBurnAmount);
        
        // Retrieve BEAR NFTs from BTBSwapLogic
        uint256[] memory bearIds;
        if (count == 1) {
            // Single redemption
            bearIds = new uint256[](1);
            bearIds[0] = btbSwapContract.retrieveAnyNFTForRedemption(msg.sender);
        } else {
            // Multiple redemption
            bearIds = btbSwapContract.retrieveMultipleNFTsForRedemption(msg.sender, count);
        }
        
        // Emit events for each NFT redeemed
        for (uint256 i = 0; i < count; i++) {
            emit BearRedeemed(msg.sender, bearIds[i], totalAmountPerNFT);
        }
        
        return bearIds;
    }
    
    
    // ========================== BTB SWAP FUNCTIONS (DELEGATED) ==========================
    function _checkBTBSwapConfigured() internal view {
        if (address(btbSwapContract) == address(0)) revert BTBSwapNotConfigured();
    }

    function getSwapRate() public view returns (uint256) {
        _checkBTBSwapConfigured();
        return btbSwapContract.getSwapRate();
    }

    function swapBTBForNFT(uint256 amount) external nonReentrant returns (uint256[] memory) {
        _checkBTBSwapConfigured();
        // The BTBSwapLogic contract handles token transfers from/to msg.sender (user)
        // and interacts with its own liquidity pool.
        // BearHunterEcosystem needs to ensure BTBSwapLogic is approved or has liquidity.
        // For this model, BTBSwapLogic holds its own liquidity.
        // User (msg.sender) needs to approve BearHunterEcosystem IF BearHunterEcosystem were to pull tokens.
        // But here, BTBSwapLogic will pull tokens from user. So user must approve BTBSwapLogic contract.
        // This means users need to know the btbSwapContract address.
        // Alternative: user approves BearHunterEcosystem, which then approves btbSwapContract or transfers to it.
        // For simplicity now, direct approval to btbSwapContract is implied by its design.
        // The call from BearHunterEcosystem to btbSwapContract.swapBTBForNFT must pass the user (msg.sender).
        return btbSwapContract.swapBTBForNFT(msg.sender, amount);
    }

    function swapNFTForBTB(uint256[] calldata tokenIds) external nonReentrant returns (uint256) {
        _checkBTBSwapConfigured();
        // Similar to above, user (msg.sender) must approve BTBSwapLogic for their NFTs.
        return btbSwapContract.swapNFTForBTB(msg.sender, tokenIds);
    }

    // Admin functions for BTBSwap delegated
    function setSwapPaused(bool paused) external onlyOwner {
        _checkBTBSwapConfigured();
        btbSwapContract.setSwapPaused(paused);
    }

    function setSwapFeePercentage(uint256 newFeePercentage) external onlyOwner {
        _checkBTBSwapConfigured();
        btbSwapContract.setSwapFeePercentage(newFeePercentage);
    }

    function setAdminFeeShare(uint256 newAdminFeeShare) external onlyOwner {
        _checkBTBSwapConfigured();
        btbSwapContract.setAdminFeeShare(newAdminFeeShare);
    }

    function setBuyPremium(uint256 newPremium) external onlyOwner {
        _checkBTBSwapConfigured();
        btbSwapContract.setBuyPremium(newPremium);
    }

    // Liquidity management for BTBSwapLogic - to be added if BearHunterEcosystem manages it.
    // For now, BTBSwapLogic has its own withdraw functions for its owner (BearHunterEcosystem).
    // Example: ecosystem owner wants to pull funds from swap module
    function withdrawBTBFromSwapModule(address to, uint256 amount) external onlyOwner {
        _checkBTBSwapConfigured();
        btbSwapContract.withdrawBTBCollected(to, amount);
    }

    function withdrawNFTsFromSwapModule(address to, uint256[] calldata tokenIds) external onlyOwner {
        _checkBTBSwapConfigured();
        btbSwapContract.withdrawBearNFTs(to, tokenIds);
    }

    // ========================== PROTECTION FUNCTIONS ==========================
    
    /**
     * @dev Set or remove protection for a single address
     * @param protectedAddress The address to set protection for
     * @param isProtected True to protect the address, false to remove protection
     */
    function setProtectedAddress(address protectedAddress, bool isProtected) external onlyOwner {
        if (protectedAddress == address(0)) revert ZeroAddressNotAllowed();
        
        protectedAddresses[protectedAddress] = isProtected;
        emit AddressProtectionUpdated(protectedAddress, isProtected);
    }
    
    /**
     * @dev Set or remove protection for multiple addresses at once
     * @param addresses Array of addresses to set protection for
     * @param isProtected True to protect the addresses, false to remove protection
     */
    function setProtectedAddresses(address[] calldata addresses, bool isProtected) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == address(0)) revert ZeroAddressNotAllowed();
            
            protectedAddresses[addresses[i]] = isProtected;
            emit AddressProtectionUpdated(addresses[i], isProtected);
        }
    }
    
    /**
     * @dev Check if an address is protected from being hunted
     * @param account The address to check
     * @return True if the address is protected
     */
    function isProtectedAddress(address account) external view returns (bool) {
        return protectedAddresses[account];
    }
    
    /**
     * @dev Remove protection from an address (convenience function)
     * @param protectedAddress The address to remove protection from
     */
    function removeProtectedAddress(address protectedAddress) external onlyOwner {
        if (protectedAddress == address(0)) revert ZeroAddressNotAllowed();
        
        protectedAddresses[protectedAddress] = false;
        emit AddressProtectionUpdated(protectedAddress, false);
    }
    
    // ========================== ADMIN / OWNER FUNCTIONS ==========================
    // ... (withdrawBTB, withdrawERC20, withdrawETH, withdrawNFTs - these currently operate on BearHunterEcosystem's own balance)
    // If they are meant for swap module liquidity, they should call BTBSwapLogic deposit/funding functions (not yet defined in BTBSwapLogic beyond constructor)
    // or use withdrawBTBFromSwapModule / withdrawNFTsFromSwapModule.

    // Original withdrawBTB - withdraws from BearHunterEcosystem's direct balance
    function withdrawBTB(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        // This refers to btbToken balance of THIS BearHunterEcosystem contract
        if (btbToken.balanceOf(address(this)) < amount ) revert InsufficientTokenBalance(); 
        bool success = btbToken.transfer(to, amount);
        if (!success) revert TransferFailed();
    }
    
    // Original withdrawNFTs - withdraws from BearHunterEcosystem's direct balance (NFTs it directly holds)
    function withdrawNFTs(address to, uint256[] calldata tokenIds) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Ensure this BearHunterEcosystem contract owns the NFT
            if (bearNFT.ownerOf(tokenIds[i]) != address(this)) revert InsufficientNFTBalance();
            bearNFT.safeTransferFrom(address(this), to, tokenIds[i]);
        }
    }

    /**
     * @notice Initializes the MiMoGaMe contract by setting this game contract's address.
     * @dev This function should be called by the owner of BearHunterEcosystem
     * after BearHunterEcosystem has been made the owner of the MiMoGaMe contract.
     * This ensures that this contract can call owner-restricted functions on MiMoGaMe
     * that are gated by the `onlyGameContract` modifier.
     */
    function initializeMiMoGameContract() external onlyOwner {
        // This call is to MiMoGaMe.setGameContractAddress(address).
        // It requires that BearHunterEcosystem (address(this)) is the current owner of mimoToken.
        mimoToken.setGameContractAddress(address(this));
    }

    // ========================== REQUIRED OVERRIDES ==========================
    
    /**
     * @dev Required overrides for inherited contracts
     */
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
    
    // Token functions are now delegated to the MiMoToken contract
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // Allow contract to receive ETH
    receive() external payable {}

    // ========================== ON-CHAIN TOKEN URI ==========================

    /**
     * @dev Returns the URI for a given token ID, with metadata and image generated on-chain.
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        if (!_exists(tokenId)) revert NonExistentToken();
        
        HunterPosition memory position = positions[tokenId]; // This will use the inherited positions mapping
        
        // Generate SVG based on hunter stats
        string memory svg = TokenURILogic.generateHunterSVG(position, tokenId, block.timestamp, RECOVERY_PERIOD); // <-- PASS RECOVERY_PERIOD
        
        // Calculate remaining lifespan
        uint256 remainingLifespan;
        uint256 endTime = uint256(position.creationTime) + LIFESPAN;
        if (block.timestamp >= endTime) {
            remainingLifespan = 0;
        } else {
            remainingLifespan = (endTime - block.timestamp) / 1 days;
        }
        
        // Generate metadata JSON
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"Hunter #', Strings.toString(tokenId), '",',
            '"description":"A fierce MiMo Hunter NFT, ready for adventure in the BearHunter Ecosystem.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Power","value":', Strings.toString(uint256(position.power)), '},', // Raw value, assuming 18 decimals
            '{"trait_type":"Creation Time","value":', Strings.toString(uint256(position.creationTime)), '},',
            '{"trait_type":"Last Feed Time","value":', Strings.toString(uint256(position.lastFeedTime)), '},',
            '{"trait_type":"Last Hunt Time","value":', Strings.toString(uint256(position.lastHuntTime)), '},',
            '{"trait_type":"Missed Feedings","value":', Strings.toString(uint256(position.missedFeedings)), '},',
            '{"trait_type":"Status","value":"', (block.timestamp > uint256(position.creationTime) + LIFESPAN ? "EXPIRED" : (position.inHibernation ? "Hibernating" : (position.recoveryStartTime > 0 ? "Recovering" : "Active"))), '"},',
            '{"trait_type":"Total Hunted","value":', Strings.toString(uint256(position.totalHunted)), '},', // Raw value
            '{"trait_type":"Days Remaining","value":', Strings.toString(remainingLifespan), '}',
            ']}'
        ))));
        
        return string(abi.encodePacked('data:application/json;base64,', json));
    }

    /**
     * @dev Allows anyone to burn a Hunter NFT if its lifespan has expired.
     * This helps prevent trading of "dead" hunters on secondary markets.
     * @param tokenId The ID of the Hunter NFT to burn.
     */
    function burnDeadHunter(uint256 tokenId) external nonReentrant {
        if (!_exists(tokenId)) revert NonExistentToken();

        HunterPosition storage pos = positions[tokenId];

        // Check if the hunter's lifespan has truly ended
        if (block.timestamp <= uint256(pos.creationTime) + LIFESPAN) {
            revert HunterNotExpired();
        }

        // The _burn function handles all ERC721 aspects: emits Transfer event to address(0), clears owner, etc.
        _burn(tokenId);
        
        // Note: The data in positions[tokenId] will remain, but since the token is burned,
        // it's no longer ownable or transferable, and standard game logic depending on ownership
        // or _exists() will naturally exclude it. Explicitly deleting from the mapping 
        // (e.g., delete positions[tokenId];) could be done for gas state refunds but is not strictly necessary
        // for the burn functionality itself and adds a bit of gas cost to this transaction.
    }

    // Function to update BTBSwapLogic address if needed (e.g. upgrade)
    function setBTBSwapContract(address _newBTBSwapContract) external onlyOwner {
        if (_newBTBSwapContract == address(0)) revert ZeroAddressNotAllowed();
        btbSwapContract = BTBSwapLogic(_newBTBSwapContract);
    }

    /**
     * @dev Required for ERC721 receiver functionality.
     * Only accepts NFTs from the bearNFT contract for deposits.
     */
    function onERC721Received(
        address, // operator - not used
        address, // from - not used
        uint256, // tokenId - not used here, specific logic in _depositBear
        bytes calldata // data - not used
    ) external view override returns (bytes4) {
        // Only accept NFTs from the configured bearNFT contract
        // This is a general receiver hook. Specific deposit logic elsewhere.
        if (msg.sender != address(bearNFT)) {
            revert InvalidNFT(); // Ensure InvalidNFT error is defined
        }
        return this.onERC721Received.selector;
    }

    /**
     * @dev Internal function to hunt from a target and increase hunter power
     * @param tokenId The Hunter NFT ID to use for hunting
     * @param targetAddress The target address to hunt from (already validated)
     */
    function _hunt(uint256 tokenId, address targetAddress) internal {
        // Get hunter data
        HunterPosition storage pos = positions[tokenId];
        
        // Hunt from target without updating cooldown
        uint128 huntedAmount = _huntWithoutCooldownUpdate(tokenId, targetAddress);
        
        // If no tokens were hunted, revert (for single hunt this should fail)
        if (huntedAmount == 0) revert InsufficientTargetBalance();
        
        // Update hunter stats for single hunt
        pos.lastHuntTime = uint96(block.timestamp);
        pos.totalHunted += huntedAmount;
        
        // Auto-feed the hunter (power increase and stat update)
        // Only if the hunter hasn't been fed today and isn't in recovery
        if (block.timestamp >= pos.lastFeedTime + 24 hours && 
            (pos.recoveryStartTime == 0 || block.timestamp >= pos.recoveryStartTime + RECOVERY_PERIOD)) {
            
            uint128 currentPower = pos.power;
            // Calculate additional power increase from feeding
            uint128 feedPowerIncrease = uint128((uint256(currentPower) * GROWTH_RATE) / 10000); // 2% from feeding
            pos.power = currentPower + feedPowerIncrease;
            
            // Update feeding-related stats
            pos.lastFeedTime = uint96(block.timestamp);
            pos.missedFeedings = 0;
        }
    }
}