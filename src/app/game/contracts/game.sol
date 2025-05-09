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
     * @dev Feed a hunter to increase its power (but cannot hunt)
     */
    function feedHunter(uint256 tokenId) external nonReentrant {
        // Call internal function to feed a single hunter
        _feedHunter(tokenId);
    }
    
    /**
     * @dev Feed multiple hunters at once to increase their power (but cannot hunt)
     * @param tokenIds Array of Hunter NFT IDs to feed
     */
    function feedMultipleHunters(uint256[] calldata tokenIds) external nonReentrant {
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
        
        // Check if already fed today (using 20 hours instead of 24 for buffer)
        if (block.timestamp < pos.lastFeedTime + 20 hours) revert AlreadyFedToday();
        
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
            // Record consecutive missed feedings
            pos.missedFeedings += uint8(daysSinceLastFeed - 1); // Potential overflow if many days missed, uint8 caps at 255
            
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
     * @dev Hunt MiMo tokens from a target address and increase hunter power
     * Also automatically feeds the hunter if possible
     * @param tokenId The Hunter NFT ID to use for hunting
     * @param target The address to hunt MiMo tokens from (if address(0), msg.sender is used)
     */
    function hunt(uint256 tokenId, address target) external nonReentrant {
        if (!_exists(tokenId)) revert NonExistentToken();
        if (ownerOf(tokenId) != msg.sender) revert NotHunterOwner();
        
        // If no target is specified, msg.sender is used
        address targetAddress = target == address(0) ? msg.sender : target;
        
        // Check if target address is protected
        if (protectedAddresses[targetAddress]) revert AddressIsProtected();
        
        HunterPosition storage pos = positions[tokenId];
        
        // Check if hunter is expired (beyond lifespan)
        if (block.timestamp > pos.creationTime + LIFESPAN) revert HunterExpired();
        
        // Check if hunter is in hibernation
        if (pos.inHibernation) revert HunterInHibernation();
        
        // Check if hunter is still recovering
        if (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) {
            revert MustWaitForRecovery();
        }
        
        // Check if hunt cooldown is active
        if (block.timestamp < pos.lastHuntTime + HUNT_COOLDOWN) revert HuntCooldownActive();
        
        // Call internal function to hunt from a single target
        _hunt(tokenId, targetAddress); // Pass validated targetAddress
    }
    
    /**
     * @dev Hunt from multiple targets at once and increase hunter power
     * @param tokenId The Hunter NFT ID to use for hunting
     * @param targets Array of target addresses to hunt from
     */
    function huntMultiple(uint256 tokenId, address[] calldata targets) external nonReentrant {
        if (targets.length == 0) revert InvalidAmount();
        
        // Basic validation for the hunter
        if (!_exists(tokenId) || ownerOf(tokenId) != msg.sender) revert NotHunterOwner();
        
        HunterPosition storage pos = positions[tokenId]; // Fetch once
        
        // Check if hunter is expired (beyond lifespan)
        if (block.timestamp > pos.creationTime + LIFESPAN) revert HunterExpired();
        
        // Check if hunter is in hibernation
        if (pos.inHibernation) revert HunterInHibernation();
        
        // Check if hunter is still recovering
        if (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) {
            revert MustWaitForRecovery();
        }
        
        // Check if hunt cooldown is active
        if (block.timestamp < pos.lastHuntTime + HUNT_COOLDOWN) revert HuntCooldownActive();
        
        // Hunt from each target in the array
        for (uint256 i = 0; i < targets.length; i++) {
            // Skip protected addresses
            address targetAddress = targets[i] == address(0) ? msg.sender : targets[i];
            if (protectedAddresses[targetAddress]) {
                continue;
            }
            
            // Skip targets with zero balance
            if (mimoToken.balanceOf(targetAddress) == 0) {
                continue;
            }
            
            // Try to hunt from this target
            _hunt(tokenId, targetAddress); // Pass validated targetAddress
        }
    }
    
    /**
     * @dev Internal function to hunt from a target and increase hunter power
     * @param tokenId The Hunter NFT ID to use for hunting
     * @param targetAddress The target address to hunt from (already validated)
     */
    function _hunt(uint256 tokenId, address targetAddress) internal {
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
            
            // If target has no tokens at all, revert
            if (huntAmount == 0) revert InsufficientTargetBalance();
        }
        
        // Update hunter stats
        pos.lastHuntTime = uint96(block.timestamp);
        pos.totalHunted += huntAmount128;
        
        // Auto-feed the hunter (power increase and stat update)
        // Only if the hunter hasn't been fed today and isn't in recovery
        if (block.timestamp >= pos.lastFeedTime + 20 hours && 
            (pos.recoveryStartTime == 0 || block.timestamp >= pos.recoveryStartTime + RECOVERY_PERIOD)) {
            
            uint128 currentPower = pos.power;
            // Calculate additional power increase from feeding
            uint128 feedPowerIncrease = uint128((uint256(currentPower) * GROWTH_RATE) / 10000); // 2% from feeding
            pos.power = currentPower + feedPowerIncrease;
            
            // Update feeding-related stats
            pos.lastFeedTime = uint96(block.timestamp);
            pos.missedFeedings = 0;
        }
        
        // Calculate reward distribution
        uint256 ownerReward = (huntAmount * ownerRewardPercentage) / 10000;
        uint256 burnAmount = (huntAmount * burnPercentage) / 10000;
        uint256 liquidityAmount = (huntAmount * liquidityPercentage) / 10000;
        
        // Transfer owner reward
        _mimoTransfer(targetAddress, msg.sender, ownerReward);
        
        // Transfer liquidity portion to liquidity receiver
        _mimoTransfer(targetAddress, liquidityReceiver, liquidityAmount);
        
        // Burn the burn portion
        _mimoBurn(targetAddress, burnAmount);
        
        emit HunterHunted(tokenId, huntAmount, ownerReward, burnAmount, liquidityAmount);
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
        
        // Check if already fed recently (within 20 hours)
        if (block.timestamp < uint256(pos.lastFeedTime) + 20 hours) {
            uint256 timeLeft = (uint256(pos.lastFeedTime) + 20 hours) - block.timestamp;
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
     * @dev Deposit a BEAR NFT to receive MiMo tokens and a Hunter NFT
     * @param bearId ID of the BEAR NFT to deposit
     */
    function depositBear(uint256 bearId) external nonReentrant whenNotPaused {
        if (depositPaused) revert DepositPaused();
        
        // Call internal function to handle single deposit
        _depositBear(bearId);
    }
    
    /**
     * @dev Deposit multiple BEAR NFTs at once to receive MiMo tokens and Hunter NFTs
     * @param bearIds Array of BEAR NFT IDs to deposit
     * @return hunterIds Array of newly created Hunter NFT IDs
     */
    function batchDepositBears(uint256[] calldata bearIds) external nonReentrant whenNotPaused returns (uint256[] memory) {
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
        uint256 tokenId = totalSupply() + 1; 
        
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
     * @dev Redeem MiMo tokens for a BEAR NFT
     * @return bearId ID of the redeemed BEAR NFT
     */
    function redeemBear() external nonReentrant whenNotPaused returns (uint256) {
        if (redemptionPaused) revert RedemptionPaused();
        
        // Use internal function to handle single redemption
        return _redeemBear();
    }
    
    /**
     * @dev Redeem MiMo tokens for multiple BEAR NFTs at once
     * @param count Number of BEAR NFTs to redeem
     * @return bearIds Array of redeemed BEAR NFT IDs
     */
    function batchRedeemBears(uint256 count) external nonReentrant whenNotPaused returns (uint256[] memory) {
        if (redemptionPaused) revert RedemptionPaused();
        if (count == 0) revert InvalidAmount();
        
        // Calculate total amount needed (base amount + fee) for all NFTs
        uint256 feeAmountPerNFT = (REDEMPTION_MIMO_AMOUNT * REDEMPTION_FEE_PERCENTAGE) / 100;
        uint256 totalAmountPerNFT = REDEMPTION_MIMO_AMOUNT + feeAmountPerNFT;
        uint256 totalAmountRequired = totalAmountPerNFT * count;
        
        // Check if user has enough MiMo tokens for all redemptions
        if (mimoToken.balanceOf(msg.sender) < totalAmountRequired) revert InsufficientTokenBalance();
        
        // Check if contract has enough BEAR NFTs available
        if (bearNFT.balanceOf(address(this)) < count) revert InsufficientNFTBalance();
        
        uint256[] memory bearIds = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            // Process each redemption
            bearIds[i] = _redeemBear();
        }
        
        return bearIds;
    }
    
    /**
     * @dev Internal function to redeem MiMo tokens for a BEAR NFT
     * @return bearId ID of the redeemed BEAR NFT
     */
    function _redeemBear() internal returns (uint256) {
        // Calculate total amount needed (base amount + fee)
        uint256 feeAmount = (REDEMPTION_MIMO_AMOUNT * REDEMPTION_FEE_PERCENTAGE) / 100;
        uint256 totalAmount = REDEMPTION_MIMO_AMOUNT + feeAmount;
        
        // Check if user has enough MiMo tokens
        if (mimoToken.balanceOf(msg.sender) < totalAmount) revert InsufficientTokenBalance();
        
        // BTBSwapLogic contract must have BEAR NFTs available
        _checkBTBSwapConfigured(); 
        // No direct balance check here, retrieveAnyNFTForRedemption will handle it or revert
        
        // Transfer fee to fee receiver
        _mimoTransfer(msg.sender, feeReceiver, feeAmount);
        
        // Burn the MIMO tokens
        _mimoBurn(msg.sender, REDEMPTION_MIMO_AMOUNT);
        
        // Retrieve a BEAR NFT from BTBSwapLogic and transfer to user
        uint256 bearId = btbSwapContract.retrieveAnyNFTForRedemption(msg.sender);
        
        emit BearRedeemed(msg.sender, bearId, totalAmount);
        
        return bearId;
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
     * @dev Get all hunters owned by an address
     */
    function getHuntersByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }

    /**
     * @dev Get hunter details in a single call (for frontend display)
     */
    function getHunterDetails(uint256 tokenId) external view returns (
        uint128 power,
        uint256 daysRemaining,
        string memory status,
        uint256 nextFeedingTime,
        uint256 nextHuntingTime,
        bool canFeedNow,
        bool canHuntNow
    ) {
        if (!_exists(tokenId)) revert NonExistentToken();
        
        HunterPosition memory pos = positions[tokenId];
        
        // Calculate days remaining
        uint256 endTime = uint256(pos.creationTime) + LIFESPAN;
        daysRemaining = block.timestamp >= endTime ? 0 : (endTime - block.timestamp) / 1 days;
        
        // Determine status
        if (block.timestamp > pos.creationTime + LIFESPAN) {
            status = "EXPIRED";
        } else if (pos.inHibernation) {
            status = "Hibernating";
        } else if (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) {
            status = "Recovering";
        } else {
            status = "Active";
        }
        
        // Calculate next feeding/hunting times
        nextFeedingTime = pos.lastFeedTime + 20 hours > block.timestamp ? pos.lastFeedTime + 20 hours : 0;
        nextHuntingTime = pos.lastHuntTime + HUNT_COOLDOWN > block.timestamp ? pos.lastHuntTime + HUNT_COOLDOWN : 0;
        
        // Simplify can feed/hunt logic for frontend
        canFeedNow = (block.timestamp > pos.creationTime + LIFESPAN) ? false : (block.timestamp >= pos.lastFeedTime + 20 hours);
        
        canHuntNow = !pos.inHibernation && 
                     !(pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) &&
                     (block.timestamp >= pos.lastHuntTime + HUNT_COOLDOWN) && 
                     (block.timestamp <= pos.creationTime + LIFESPAN);
        
        return (
            pos.power,
            daysRemaining,
            status,
            nextFeedingTime,
            nextHuntingTime,
            canFeedNow,
            canHuntNow
        );
    }

    /**
     * @dev Get all ecosystem statistics in one call
     */
    function getEcosystemStats() external view returns (
        uint256 totalHunters,
        uint256 totalActiveHunters,
        uint256 totalExpiredHunters,
        uint256 mimoTokenSupply,
        uint256 currentBTBSwapRate,
        uint256 bearsInEcosystem
    ) {
        totalHunters = totalSupply();
        
        // Count active and expired hunters
        totalActiveHunters = 0;
        totalExpiredHunters = 0;
        
        // Note: This loop could be gas-intensive for large numbers of tokens
        // Alternative: Track these counts when minting/expiring hunters
        for (uint256 i = 1; i <= totalHunters; i++) {
            if (_exists(i)) {
                HunterPosition memory pos = positions[i];
                if (block.timestamp > uint256(pos.creationTime) + LIFESPAN) {
                    totalExpiredHunters++;
                } else {
                    totalActiveHunters++;
                }
            }
        }
        
        mimoTokenSupply = mimoToken.totalSupply();
        currentBTBSwapRate = getSwapRate();
        bearsInEcosystem = bearNFT.balanceOf(address(btbSwapContract));
        
        return (
            totalHunters,
            totalActiveHunters,
            totalExpiredHunters,
            mimoTokenSupply,
            currentBTBSwapRate,
            bearsInEcosystem
        );
    }

    /**
     * @dev Get user account info in a single call
     */
    function getUserAccountInfo(address user) external view returns (
        uint256 mimoBalance,
        uint256 btbBalance,
        uint256 hunterCount,
        uint256 activeHunterCount,
        uint256 expiredHunterCount,
        bool canDepositBear,
        bool canRedeemBear
    ) {
        mimoBalance = mimoToken.balanceOf(user);
        btbBalance = btbToken.balanceOf(user);
        hunterCount = balanceOf(user);
        
        // Count active and expired hunters owned by user
        activeHunterCount = 0;
        expiredHunterCount = 0;
        
        for (uint256 i = 0; i < hunterCount; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(user, i);
            HunterPosition memory pos = positions[tokenId];
            if (block.timestamp > uint256(pos.creationTime) + LIFESPAN) {
                expiredHunterCount++;
            } else {
                activeHunterCount++;
            }
        }
        
        // Check if user can deposit or redeem
        canDepositBear = !depositPaused;
        
        uint256 feeAmount = (REDEMPTION_MIMO_AMOUNT * REDEMPTION_FEE_PERCENTAGE) / 100;
        uint256 totalAmount = REDEMPTION_MIMO_AMOUNT + feeAmount;
        canRedeemBear = !redemptionPaused && (mimoBalance >= totalAmount) && (bearNFT.balanceOf(address(btbSwapContract)) > 0);
        
        return (
            mimoBalance,
            btbBalance,
            hunterCount,
            activeHunterCount,
            expiredHunterCount,
            canDepositBear,
            canRedeemBear
        );
    }

    /**
     * @dev Get hunters with pagination support for efficient frontend loading
     * @param owner Address of the hunter owner
     * @param offset Starting index in the owner's hunters
     * @param limit Maximum number of hunters to return
     */
    function getPaginatedHuntersByOwner(
        address owner, 
        uint256 offset, 
        uint256 limit
    ) external view returns (
        uint256[] memory tokenIds,
        bool hasMore
    ) {
        uint256 balance = balanceOf(owner);
        
        if (offset >= balance) {
            return (new uint256[](0), false);
        }
        
        uint256 count = balance - offset;
        if (count > limit) {
            count = limit;
            hasMore = true;
        } else {
            hasMore = false;
        }
        
        tokenIds = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, offset + i);
        }
        
        return (tokenIds, hasMore);
    }
    
    /**
     * @dev Get most efficient hunting targets based on MiMo token balances
     * @param hunterPower The power of the hunter to calculate potential rewards
     * @param maxTargets Maximum number of targets to return
     */
    function getBestHuntingTargets(
        uint256 hunterPower, 
        uint256 maxTargets
    ) external view returns (
        address[] memory targets, 
        uint256[] memory potentialRewards
    ) {
        // This is a simplified implementation for demonstration
        // A production version would need more efficient filtering logic
        
        // We'll look through recent token transfers to find active addresses
        // For this simplified version, we'll check some predefined addresses
        
        address[] memory potentialTargets = new address[](5);
        potentialTargets[0] = address(this);  // Contract itself
        potentialTargets[1] = feeReceiver;    // Fee receiver
        potentialTargets[2] = liquidityReceiver; // Liquidity receiver
        potentialTargets[3] = owner();        // Contract owner
        potentialTargets[4] = msg.sender;     // Caller (for testing)
        
        // Count valid targets (not protected, has balance)
        uint256 validCount = 0;
        for (uint256 i = 0; i < potentialTargets.length; i++) {
            address target = potentialTargets[i];
            if (!protectedAddresses[target] && mimoToken.balanceOf(target) > 0) {
                validCount++;
            }
        }
        
        // Cap to requested max
        uint256 resultCount = validCount < maxTargets ? validCount : maxTargets;
        targets = new address[](resultCount);
        potentialRewards = new uint256[](resultCount);
        
        // Fill results
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < potentialTargets.length && resultIndex < resultCount; i++) {
            address target = potentialTargets[i];
            if (!protectedAddresses[target]) {
                uint256 targetBalance = mimoToken.balanceOf(target);
                if (targetBalance > 0) {
                    uint256 huntAmount = targetBalance < hunterPower ? targetBalance : hunterPower;
                    uint256 ownerReward = (huntAmount * ownerRewardPercentage) / 10000;
                    
                    targets[resultIndex] = target;
                    potentialRewards[resultIndex] = ownerReward;
                    resultIndex++;
                }
            }
        }
        
        return (targets, potentialRewards);
    }
    
    /**
     * @dev Get hunters that need attention (feeding, hibernating, recovering)
     * @param owner Address of the hunter owner
     */
    function getHuntersThatNeedAttention(address owner) external view returns (
        uint256[] memory needFeeding,
        uint256[] memory hibernating,
        uint256[] memory recovering
    ) {
        uint256 balance = balanceOf(owner);
        
        // First, count how many fall into each category
        uint256 feedingCount = 0;
        uint256 hibernatingCount = 0;
        uint256 recoveringCount = 0;
        
        // Temporary arrays to store the indices
        uint256[] memory feedingIndices = new uint256[](balance);
        uint256[] memory hibernatingIndices = new uint256[](balance);
        uint256[] memory recoveringIndices = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            HunterPosition memory pos = positions[tokenId];
            
            // Skip expired hunters
            if (block.timestamp > pos.creationTime + LIFESPAN) {
                continue;
            }
            
            if (pos.inHibernation) {
                hibernatingIndices[hibernatingCount++] = tokenId;
            } else if (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) {
                recoveringIndices[recoveringCount++] = tokenId;
            } else if (block.timestamp >= pos.lastFeedTime + 20 hours) {
                feedingIndices[feedingCount++] = tokenId;
            }
        }
        
        // Create appropriately sized result arrays
        needFeeding = new uint256[](feedingCount);
        hibernating = new uint256[](hibernatingCount);
        recovering = new uint256[](recoveringCount);
        
        // Copy the results
        for (uint256 i = 0; i < feedingCount; i++) {
            needFeeding[i] = feedingIndices[i];
        }
        
        for (uint256 i = 0; i < hibernatingCount; i++) {
            hibernating[i] = hibernatingIndices[i];
        }
        
        for (uint256 i = 0; i < recoveringCount; i++) {
            recovering[i] = recoveringIndices[i];
        }
        
        return (needFeeding, hibernating, recovering);
    }
    
    /**
     * @dev Get admin dashboard information (for owner only)
     */
    function getAdminDashboardInfo() external view returns (
        uint256 totalHunters,
        uint256 mimoTokenSupply,
        uint256 btbTokenBalance,
        uint256 nftBalance,
        uint256 btbSwapContractBalance,
        uint256 btbSwapContractNFTs
    ) {
        totalHunters = totalSupply();
        mimoTokenSupply = mimoToken.totalSupply();
        btbTokenBalance = btbToken.balanceOf(address(this));
        nftBalance = bearNFT.balanceOf(address(this));
        btbSwapContractBalance = btbToken.balanceOf(address(btbSwapContract));
        btbSwapContractNFTs = bearNFT.balanceOf(address(btbSwapContract));
        
        return (
            totalHunters,
            mimoTokenSupply,
            btbTokenBalance,
            nftBalance,
            btbSwapContractBalance,
            btbSwapContractNFTs
        );
    }
    
    /**
     * @dev Get time until next feeding/hunting is available for a specific hunter
     */
    function getHunterCooldowns(uint256 tokenId) external view returns (
        bool canFeedNow,
        bool canHuntNow,
        uint256 timeUntilNextFeeding,
        uint256 timeUntilNextHunting,
        uint256 timeUntilRecoveryComplete
    ) {
        if (!_exists(tokenId)) revert NonExistentToken();
        
        HunterPosition memory pos = positions[tokenId];
        
        // Check if hunter is expired
        if (block.timestamp > pos.creationTime + LIFESPAN) {
            return (false, false, 0, 0, 0);
        }
        
        // Calculate cooldowns
        if (block.timestamp < pos.lastFeedTime + 20 hours) {
            timeUntilNextFeeding = pos.lastFeedTime + 20 hours - block.timestamp;
            canFeedNow = false;
        } else {
            timeUntilNextFeeding = 0;
            canFeedNow = true;
        }
        
        if (block.timestamp < pos.lastHuntTime + HUNT_COOLDOWN) {
            timeUntilNextHunting = pos.lastHuntTime + HUNT_COOLDOWN - block.timestamp;
            canHuntNow = false;
        } else {
            timeUntilNextHunting = 0;
            canHuntNow = true && !pos.inHibernation && 
                         !(pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD);
        }
        
        // Calculate recovery time if applicable
        if (pos.recoveryStartTime > 0 && block.timestamp < pos.recoveryStartTime + RECOVERY_PERIOD) {
            timeUntilRecoveryComplete = pos.recoveryStartTime + RECOVERY_PERIOD - block.timestamp;
        } else {
            timeUntilRecoveryComplete = 0;
        }
        
        return (
            canFeedNow,
            canHuntNow,
            timeUntilNextFeeding,
            timeUntilNextHunting,
            timeUntilRecoveryComplete
        );
    }
}