// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBTBBear {
    function withdrawFees() external;
    function pendingFees() external view returns (uint256);
}

/// @title Bear NFT Staking (Fungible Pool)
/// @notice Stake BearNFTs to earn BTBB rewards - all NFTs treated equally
/// @dev Users stake X NFTs and can unstake X NFTs (random from pool)
///      This is simpler and more gas efficient than tracking individual tokens
contract BearStaking is IERC721Receiver, Ownable, ReentrancyGuard {
    
    IERC721 public immutable bearNFT;
    IERC20 public immutable btbbToken;
    IBTBBear public immutable btbbContract;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              STATE
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Array of all staked token IDs (pool)
    uint256[] public stakedTokens;
    
    /// @notice Total NFTs currently staked
    uint256 public totalStaked;
    
    /// @notice Accumulated rewards per NFT (scaled by 1e18)
    uint256 public accRewardPerNFT;
    
    /// @notice Total rewards ever distributed
    uint256 public totalRewardsDistributed;
    
    /// @notice Rewards tracking for APR
    uint256 public rewardsLast24h;
    uint256 public lastRewardUpdate;
    
    /// @notice User staking info
    struct UserInfo {
        uint128 stakedCount;       // Number of NFTs user has staked
        uint128 pendingRewards;    // Pending rewards
        uint256 rewardDebt;        // Reward debt for accounting
    }
    
    mapping(address => UserInfo) public userInfo;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    
    event Staked(address indexed user, uint256 count, uint256[] tokenIds);
    event Unstaked(address indexed user, uint256 count, uint256[] tokenIds);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsAdded(uint256 amount);
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════
    
    error ZeroAmount();
    error InsufficientStake();
    error InsufficientPoolBalance();
    
    // ═══════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════
    
    constructor(
        address _bearNFT,
        address _btbbToken,
        address _owner
    ) Ownable(_owner) {
        bearNFT = IERC721(_bearNFT);
        btbbToken = IERC20(_btbbToken);
        btbbContract = IBTBBear(_btbbToken);
        lastRewardUpdate = block.timestamp;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Stake NFTs to earn rewards
     * @param tokenIds Array of token IDs to stake
     */
    function stake(uint256[] calldata tokenIds) external nonReentrant {
        uint256 count = tokenIds.length;
        if (count == 0) revert ZeroAmount();
        
        _collectFees();
        _updateUserRewards(msg.sender);
        
        UserInfo storage user = userInfo[msg.sender];
        
        // Transfer NFTs to pool
        for (uint256 i; i < count; ++i) {
            uint256 tokenId = tokenIds[i];
            bearNFT.transferFrom(msg.sender, address(this), tokenId);
            stakedTokens.push(tokenId);
        }
        
        unchecked {
            user.stakedCount += uint128(count);
            totalStaked += count;
        }
        
        user.rewardDebt = (uint256(user.stakedCount) * accRewardPerNFT) / 1e18;
        
        emit Staked(msg.sender, count, tokenIds);
    }
    
    /**
     * @notice Unstake NFTs and claim rewards
     * @param count Number of NFTs to unstake (gets random NFTs from pool)
     */
    function unstake(uint256 count) external nonReentrant {
        if (count == 0) revert ZeroAmount();
        
        UserInfo storage user = userInfo[msg.sender];
        if (user.stakedCount < count) revert InsufficientStake();
        if (stakedTokens.length < count) revert InsufficientPoolBalance();
        
        _collectFees();
        _updateUserRewards(msg.sender);
        _claimRewards(msg.sender);
        
        uint256[] memory returnedTokens = new uint256[](count);
        
        // Pop NFTs from end of array (gas efficient, pseudo-random)
        for (uint256 i; i < count; ++i) {
            uint256 tokenId = stakedTokens[stakedTokens.length - 1];
            stakedTokens.pop();
            bearNFT.transferFrom(address(this), msg.sender, tokenId);
            returnedTokens[i] = tokenId;
        }
        
        unchecked {
            user.stakedCount -= uint128(count);
            totalStaked -= count;
        }
        
        user.rewardDebt = (uint256(user.stakedCount) * accRewardPerNFT) / 1e18;
        
        emit Unstaked(msg.sender, count, returnedTokens);
    }
    
    /**
     * @notice Claim pending rewards
     */
    function claim() external nonReentrant {
        _collectFees();
        _updateUserRewards(msg.sender);
        _claimRewards(msg.sender);
    }
    
    /**
     * @notice Collect fees from BTBBear (anyone can call)
     */
    function collectFees() external nonReentrant {
        _collectFees();
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    function _collectFees() internal {
        // Don't collect if no stakers - fees stay in BTBBear until someone stakes
        if (totalStaked == 0) return;
        
        uint256 pending = btbbContract.pendingFees();
        if (pending == 0) return;
        
        uint256 balanceBefore = btbbToken.balanceOf(address(this));
        
        try btbbContract.withdrawFees() {
            uint256 received = btbbToken.balanceOf(address(this)) - balanceBefore;
            if (received > 0) {
                _distributeRewards(received);
            }
        } catch {}
    }
    
    function _distributeRewards(uint256 amount) internal {
        if (totalStaked == 0) return;
        
        unchecked {
            accRewardPerNFT += (amount * 1e18) / totalStaked;
            totalRewardsDistributed += amount;
            
            uint256 timePassed = block.timestamp - lastRewardUpdate;
            if (timePassed >= 1 days) {
                rewardsLast24h = amount;
                lastRewardUpdate = block.timestamp;
            } else {
                rewardsLast24h += amount;
            }
        }
        
        emit RewardsAdded(amount);
    }
    
    function _updateUserRewards(address _user) internal {
        UserInfo storage user = userInfo[_user];
        uint256 stakedCount = user.stakedCount;
        
        if (stakedCount > 0) {
            unchecked {
                uint256 pending = ((stakedCount * accRewardPerNFT) / 1e18) - user.rewardDebt;
                user.pendingRewards += uint128(pending);
            }
        }
    }
    
    function _claimRewards(address _user) internal {
        UserInfo storage user = userInfo[_user];
        uint256 rewards = user.pendingRewards;
        
        if (rewards > 0) {
            user.pendingRewards = 0;
            user.rewardDebt = (uint256(user.stakedCount) * accRewardPerNFT) / 1e18;
            btbbToken.transfer(_user, rewards);
            emit RewardsClaimed(_user, rewards);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get pending rewards for a user (gross, before 1% transfer tax)
     */
    function pendingRewards(address _user) public view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 stakedCount = user.stakedCount;
        
        if (stakedCount == 0) return user.pendingRewards;
        
        uint256 pendingFees = btbbContract.pendingFees();
        uint256 adjustedAccReward = accRewardPerNFT;
        
        if (totalStaked > 0 && pendingFees > 0) {
            adjustedAccReward += (pendingFees * 1e18) / totalStaked;
        }
        
        uint256 pending = ((stakedCount * adjustedAccReward) / 1e18) - user.rewardDebt;
        return user.pendingRewards + pending;
    }
    
    /**
     * @notice Get pending rewards AFTER 1% BTBBear transfer tax
     * @dev This is what user will actually receive when claiming
     */
    function pendingRewardsNet(address _user) external view returns (uint256) {
        uint256 gross = pendingRewards(_user);
        // BTBBear takes 1% on all transfers (100 basis points)
        return gross - (gross * 100 / 10000);
    }
    
    /**
     * @notice Get detailed pending rewards (gross and net)
     */
    function pendingRewardsDetailed(address _user) 
        external 
        view 
        returns (uint256 gross, uint256 net, uint256 taxAmount) 
    {
        gross = pendingRewards(_user);
        taxAmount = gross * 100 / 10000;  // 1%
        net = gross - taxAmount;
    }
    
    /**
     * @notice Get user's staked count
     */
    function stakedCountOf(address _user) external view returns (uint256) {
        return userInfo[_user].stakedCount;
    }
    
    /**
     * @notice Get pool size
     */
    function poolSize() external view returns (uint256) {
        return stakedTokens.length;
    }
    
    /**
     * @notice Get a single token ID at index
     */
    function tokenAtIndex(uint256 index) external view returns (uint256) {
        require(index < stakedTokens.length, "Index out of bounds");
        return stakedTokens[index];
    }
    
    /**
     * @notice Get paginated pool tokens (for large pools)
     * @param offset Starting index
     * @param limit Max tokens to return
     */
    function getPoolTokensPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory tokens, uint256 total) 
    {
        total = stakedTokens.length;
        if (offset >= total) {
            return (new uint256[](0), total);
        }
        
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        
        tokens = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            tokens[i] = stakedTokens[offset + i];
        }
    }
    
    /**
     * @notice Estimate APR
     */
    function estimatedAPR() external view returns (uint256) {
        if (totalStaked == 0) return 0;
        
        uint256 pendingFees = btbbContract.pendingFees();
        uint256 dailyRewards = rewardsLast24h + pendingFees;
        
        if (dailyRewards == 0) return 0;
        
        return (dailyRewards * 365 * 10000) / totalStaked;
    }
    
    /**
     * @notice Get comprehensive stats
     */
    function getStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalRewardsDistributed,
        uint256 _pendingToCollect,
        uint256 _rewardsLast24h,
        uint256 _estimatedAPR
    ) {
        _totalStaked = totalStaked;
        _totalRewardsDistributed = totalRewardsDistributed;
        _pendingToCollect = btbbContract.pendingFees();
        _rewardsLast24h = rewardsLast24h;
        
        if (totalStaked > 0) {
            uint256 dailyRewards = rewardsLast24h + _pendingToCollect;
            _estimatedAPR = (dailyRewards * 365 * 10000) / totalStaked;
        }
    }
    
    /**
     * @notice Get user info
     */
    function getUserInfo(address _user) external view returns (
        uint256 staked,
        uint256 pending,
        uint256 debt
    ) {
        UserInfo storage user = userInfo[_user];
        staked = user.stakedCount;
        pending = user.pendingRewards;
        debt = user.rewardDebt;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          ERC721 RECEIVER
    // ═══════════════════════════════════════════════════════════════════════
    
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
