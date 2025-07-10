// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MiMoLPStaking
 * @dev Staking contract for LP tokens with MiMo token rewards
 * Distributes rewards over 100 days regardless of when they arrive
 */
contract MiMoLPStaking is Ownable, ReentrancyGuard {
    
    // ================= STATE VARIABLES =================
    
    IERC20 public immutable lpToken;        // The LP token users stake
    IERC20 public immutable mimoToken;      // MiMo reward token
    
    // Global reward tracking
    uint256 public constant REWARD_DURATION = 100 days; // Always distribute over 100 days
    uint256 public rewardRate;              // MiMo tokens per second
    uint256 public periodFinish;            // When current reward period ends
    uint256 public lastUpdateTime;          // Last time reward calculations updated
    uint256 public rewardPerTokenStored;    // Accumulated rewards per LP token (scaled by 1e18)
    
    // Staking tracking
    uint256 public totalStaked;             // Total LP tokens staked by all users
    uint256 public totalRewardsDistributed; // Total rewards paid out to users
    uint256 public totalRewardsReceived;    // Total rewards received from game
    
    // Safety limits
    uint256 public constant MAX_STAKE_AMOUNT = 1e30; // 1 billion tokens max
    uint256 public constant MAX_REWARD_AMOUNT = 1e30; // 1 billion tokens max
    
    // User data
    struct UserInfo {
        uint256 stakedAmount;           // LP tokens this user has staked
        uint256 rewardPerTokenPaid;     // Last rewardPerToken when user interacted
        uint256 pendingRewards;         // Calculated but unclaimed rewards
    }
    mapping(address => UserInfo) public userInfo;
    
    // ================= EVENTS =================
    
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsAdded(uint256 amount, uint256 newRate, uint256 newPeriodFinish);
    
    // ================= ERRORS =================
    
    error ZeroAmount();
    error InsufficientBalance();
    error TransferFailed();
    error ZeroAddress();
    error AmountTooLarge();
    error CalculationOverflow();
    
    // ================= CONSTRUCTOR =================
    
    constructor(
        address _lpToken,
        address _mimoToken,
        address _owner
    ) Ownable(_owner) {
        if (_lpToken == address(0) || _mimoToken == address(0)) revert ZeroAddress();
        
        lpToken = IERC20(_lpToken);
        mimoToken = IERC20(_mimoToken);
        totalRewardsDistributed = 0;
        totalRewardsReceived = 0;
    }
    
    // ================= MODIFIERS =================
    
    /**
     * @dev Updates reward calculations before any state changes
     * Also checks for new tokens from game contract and activates them
     */
    modifier updateReward(address account) {
        // Check for new tokens from game and auto-activate them
        _checkAndActivateNewTokens();
        
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        
        if (account != address(0)) {
            UserInfo storage user = userInfo[account];
            uint256 newEarned = earned(account);
            // Prevent overflow in reward calculations
            if (newEarned > MAX_REWARD_AMOUNT) revert CalculationOverflow();
            // Only update if the calculation is valid
            if (newEarned >= user.pendingRewards) {
                user.pendingRewards = newEarned;
            }
            user.rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }
    
    /**
     * @dev Public function to manually trigger auto-detection
     * Useful for updating rewards before view calls
     */
    function updateRewards() external {
        _checkAndActivateNewTokens();
    }
    
    // ================= VIEW FUNCTIONS =================
    
    /**
     * @dev Returns the last time rewards were applicable
     */
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }
    
    /**
     * @dev Calculates current reward per token (scaled by 1e18)
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        
        uint256 timeDelta = lastTimeRewardApplicable() - lastUpdateTime;
        
        // Prevent overflow in calculations
        if (timeDelta > type(uint128).max || rewardRate > type(uint128).max) {
            return rewardPerTokenStored; // Return stored value if calculation would overflow
        }
        
        uint256 additionalRewardPerToken = (timeDelta * rewardRate * 1e18) / totalStaked;
        
        // Check for overflow before addition
        if (rewardPerTokenStored > type(uint256).max - additionalRewardPerToken) {
            return rewardPerTokenStored; // Return stored value if addition would overflow
        }
        
        return rewardPerTokenStored + additionalRewardPerToken;
    }
    
    /**
     * @dev Calculate total earned rewards for a user
     */
    function earned(address account) public view returns (uint256) {
        UserInfo storage user = userInfo[account];
        
        uint256 currentRewardPerToken = rewardPerToken();
        
        // Prevent underflow
        if (currentRewardPerToken < user.rewardPerTokenPaid) {
            return user.pendingRewards;
        }
        
        uint256 rewardPerTokenDelta = currentRewardPerToken - user.rewardPerTokenPaid;
        
        // Prevent overflow in multiplication
        if (user.stakedAmount > 0 && rewardPerTokenDelta > type(uint256).max / user.stakedAmount) {
            return user.pendingRewards; // Return pending if calculation would overflow
        }
        
        uint256 newlyEarned = (user.stakedAmount * rewardPerTokenDelta) / 1e18;
        
        // Prevent overflow in addition
        if (user.pendingRewards > type(uint256).max - newlyEarned) {
            return type(uint256).max; // Cap at max value
        }
        
        return user.pendingRewards + newlyEarned;
    }
    
    /**
     * @dev Get user's staking info
     */
    function getUserInfo(address account) external view returns (
        uint256 staked,
        uint256 earnedRewards,
        uint256 pendingRewards
    ) {
        UserInfo storage user = userInfo[account];
        return (
            user.stakedAmount,
            earned(account),
            user.pendingRewards
        );
    }
    
    /**
     * @dev Get global staking stats
     */
    function getGlobalInfo() external view returns (
        uint256 _totalStaked,
        uint256 _rewardRate,
        uint256 _periodFinish,
        uint256 _rewardPerToken
    ) {
        return (
            totalStaked,
            rewardRate,
            periodFinish,
            rewardPerToken()
        );
    }
    
    /**
     * @dev Get current APR (Annual Percentage Rate) in basis points
     * @return apr The APR in basis points (10000 = 100%)
     * Returns 0 if no staking, no rewards, or reward period has ended
     */
    function getAPR() external view returns (uint256 apr) {
        // Return 0 if no staking, no rewards, or reward period has ended
        if (totalStaked == 0 || rewardRate == 0 || block.timestamp >= periodFinish) {
            return 0;
        }
        
        // Calculate yearly rewards = rewardRate * seconds per year
        uint256 secondsPerYear = 365 * 24 * 60 * 60;
        
        // Prevent overflow in yearly rewards calculation
        if (rewardRate > type(uint256).max / secondsPerYear) {
            return 0; // Return 0 if calculation would overflow
        }
        
        uint256 yearlyRewards = rewardRate * secondsPerYear;
        
        // APR = (yearly rewards / total staked) * 10000 (basis points)
        // Prevent overflow in APR calculation
        if (yearlyRewards > type(uint256).max / 10000) {
            return 0; // Return 0 if calculation would overflow
        }
        
        apr = (yearlyRewards * 10000) / totalStaked;
    }
    
    // ================= USER FUNCTIONS =================
    
    /**
     * @dev Stake LP tokens to earn MiMo rewards
     * @param amount Amount of LP tokens to stake
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (amount > MAX_STAKE_AMOUNT) revert AmountTooLarge();
        
        // Prevent overflow in total staked
        if (totalStaked > type(uint256).max - amount) revert CalculationOverflow();
        
        // Prevent overflow in user staked amount
        if (userInfo[msg.sender].stakedAmount > type(uint256).max - amount) revert CalculationOverflow();
        
        // Update user data
        userInfo[msg.sender].stakedAmount += amount;
        totalStaked += amount;
        
        // Transfer LP tokens from user to contract
        if (!lpToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake LP tokens (also claims any pending rewards)
     * @param amount Amount of LP tokens to unstake
     */
    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        
        UserInfo storage user = userInfo[msg.sender];
        if (user.stakedAmount < amount) revert InsufficientBalance();
        
        // Update user data
        user.stakedAmount -= amount;
        totalStaked -= amount;
        
        // Claim any pending rewards while we're here
        uint256 rewards = user.pendingRewards;
        if (rewards > 0) {
            user.pendingRewards = 0;
            if (!mimoToken.transfer(msg.sender, rewards)) {
                revert TransferFailed();
            }
            // Track total rewards distributed
            totalRewardsDistributed += rewards;
            emit RewardsClaimed(msg.sender, rewards);
        }
        
        // Transfer LP tokens back to user
        if (!lpToken.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim earned MiMo rewards without unstaking
     */
    function claimRewards() external nonReentrant updateReward(msg.sender) {
        UserInfo storage user = userInfo[msg.sender];
        uint256 rewards = user.pendingRewards;
        
        if (rewards == 0) revert ZeroAmount();
        
        user.pendingRewards = 0;
        
        if (!mimoToken.transfer(msg.sender, rewards)) {
            revert TransferFailed();
        }
        
        // Track total rewards distributed
        totalRewardsDistributed += rewards;
        
        emit RewardsClaimed(msg.sender, rewards);
    }
    
    /**
     * @dev Emergency unstake all tokens (forfeits pending rewards)
     */
    function emergencyUnstake() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.stakedAmount;
        
        if (amount == 0) revert ZeroAmount();
        
        // Clear user data
        user.stakedAmount = 0;
        user.pendingRewards = 0;
        user.rewardPerTokenPaid = 0;
        totalStaked -= amount;
        
        // Transfer LP tokens back (no rewards)
        if (!lpToken.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }
        
        emit Unstaked(msg.sender, amount);
    }
    
    // ================= ADMIN FUNCTIONS =================
    
    /**
     * @dev Add new MiMo rewards to be distributed over next 100 days
     * This function is called when hunt/redeem functions send MiMo to this contract
     * @param rewardAmount Amount of MiMo tokens to distribute
     */
    function addRewards(uint256 rewardAmount) external updateReward(address(0)) {
        // Allow zero amount for period extension
        if (rewardAmount > MAX_REWARD_AMOUNT) revert AmountTooLarge();
        
        // Calculate remaining rewards from current period
        uint256 remainingRewards = 0;
        if (block.timestamp < periodFinish) {
            uint256 timeLeft = periodFinish - block.timestamp;
            // Prevent overflow in remaining rewards calculation
            if (timeLeft <= type(uint256).max / rewardRate) {
                remainingRewards = timeLeft * rewardRate;
            }
        }
        
        // Prevent overflow in total rewards calculation
        uint256 totalRewards;
        if (remainingRewards > type(uint256).max - rewardAmount) {
            totalRewards = type(uint256).max; // Cap at max value
        } else {
            totalRewards = remainingRewards + rewardAmount;
        }
        
        // New rate for 100 days
        rewardRate = totalRewards / REWARD_DURATION;
        
        // Reset period to 100 days from now
        periodFinish = block.timestamp + REWARD_DURATION;
        lastUpdateTime = block.timestamp;
        
        // Track manually added rewards
        totalRewardsReceived += rewardAmount;
        
        emit RewardsAdded(rewardAmount, rewardRate, periodFinish);
    }
    
    /**
     * @dev Internal function to check for new MiMo tokens and auto-activate them
     * This allows game contract to just transfer tokens without calling addRewards
     */
    function _checkAndActivateNewTokens() internal {
        uint256 currentBalance = mimoToken.balanceOf(address(this));
        
        // Expected balance = total received from game - total distributed to users
        uint256 expectedBalance = totalRewardsReceived - totalRewardsDistributed;
        
        // If current balance > expected balance, we have new tokens from game
        if (currentBalance > expectedBalance) {
            uint256 newTokens = currentBalance - expectedBalance;
            
            // Only activate if amount is meaningful (> 1 wei)
            if (newTokens > 1) {
                // Prevent overflow
                if (newTokens <= MAX_REWARD_AMOUNT) {
                    // Calculate remaining rewards from current period
                    uint256 remainingRewards = 0;
                    if (block.timestamp < periodFinish) {
                        uint256 timeLeft = periodFinish - block.timestamp;
                        if (timeLeft <= type(uint256).max / rewardRate) {
                            remainingRewards = timeLeft * rewardRate;
                        }
                    }
                    
                    // Total rewards = remaining + new
                    uint256 totalRewards;
                    if (remainingRewards > type(uint256).max - newTokens) {
                        totalRewards = type(uint256).max;
                    } else {
                        totalRewards = remainingRewards + newTokens;
                    }
                    
                    // New rate for 100 days
                    rewardRate = totalRewards / REWARD_DURATION;
                    
                    // Reset period to 100 days from now
                    periodFinish = block.timestamp + REWARD_DURATION;
                    lastUpdateTime = block.timestamp;
                    
                    // Track that we received these new tokens
                    totalRewardsReceived += newTokens;
                    
                    emit RewardsAdded(newTokens, rewardRate, periodFinish);
                }
            }
        }
    }
    
    /**
     * @dev Owner can recover accidentally sent tokens (except LP and MiMo)
     */
    function recoverToken(address token, uint256 amount) external onlyOwner {
        if (token == address(lpToken) || token == address(mimoToken)) {
            revert("Cannot recover staking or reward tokens");
        }
        
        IERC20(token).transfer(owner(), amount);
    }
}