// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title BTBMining
 * @author BTB Finance Team
 * @notice Square-based mining game for BTB tokens with provable randomness
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 DEPLOYMENT INFO - Base Mainnet (Chain ID: 8453)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Implementation: 0x17346B4fB60E87CCb8b0bDFDc0bEdC7734c73cE7
 * Proxy (Vanity):  0x88888DC54965374764F85cB5AB1B45DCEf186508
 * ProxyAdmin:      0x268ae4e6c89c492ce837ecde257a7f423f10442b
 *
 * BaseScan: https://basescan.org/address/0x88888DC54965374764F85cB5AB1B45DCEf186508
 *
 * Deployed via CREATE3Factory for deterministic vanity address
 * Salt: 1417202
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 UPGRADE INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * To upgrade this contract:
 *
 * 1. Deploy new implementation:
 *    forge create src/BTBMining.sol:BTBMining \
 *      --constructor-args <BTB_TOKEN> <VRF_COORDINATOR> \
 *      --rpc-url https://mainnet.base.org \
 *      --private-key $PRIVATE_KEY
 *
 * 2. Upgrade via ProxyAdmin:
 *    cast send 0x268ae4e6c89c492ce837ecde257a7f423f10442b \
 *      "upgradeAndCall(address,address,bytes)" \
 *      0x88888DC54965374764F85cB5AB1B45DCEf186508 \
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
 * @dev Miners deploy ETH to 25 squares, winners selected via Chainlink VRF
 *
 * Game Mechanics:
 * - 25 squares (5x5 grid) available for deployment
 * - Miners deploy ETH to one or more squares
 * - Round ends after 60 seconds
 * - Random winning square selected using Chainlink VRF v2.5
 * - Winners split the pot + earn BTB rewards
 * - Losers' ETH redistributed to winners proportionally
 * - 5-year emission schedule for BTB rewards
 * - 10% admin fee sent to bonding curve
 * - Upgradeable via TransparentUpgradeableProxy pattern
 */
contract BTBMining is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Number of squares on the board
    uint256 public constant NUM_SQUARES = 25;

    /// @notice Round duration (60 seconds)
    uint256 public constant DEFAULT_ROUND_DURATION = 60;

    /// @notice Minimum deployment per square
    uint256 public constant MIN_DEPLOYMENT = 0.0000001 ether;

    /// @notice Maximum deployment per square per miner
    uint256 public constant MAX_DEPLOYMENT_PER_SQUARE = 10 ether;

    /// @notice Admin fee (10%)
    uint256 public constant ADMIN_FEE_BPS = 1000;
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Total BTB rewards (5 years)
    uint256 public constant TOTAL_BTB_REWARDS = 88_888_888_888 * 10**18;

    /// @notice Mining duration (5 years)
    uint256 public constant MINING_DURATION = 5 * 365 days;

    /// @notice BTB per round rewards
    uint256 public constant BTB_PER_ROUND_NORMAL = 20_000 * 10**18;
    uint256 public constant BTB_PER_ROUND_JACKPOT = 10_000 * 10**18;

    /// @notice Motherlode tiers count
    uint256 public constant NUM_MOTHERLODE_TIERS = 10;

    /// @notice BTB per motherlode tier
    uint256 public constant BTB_PER_MOTHERLODE_TIER_NORMAL = 1_000 * 10**18;
    uint256 public constant BTB_PER_MOTHERLODE_TIER_JACKPOT = 2_000 * 10**18;

    /// @notice Motherlode tier probabilities
    uint256 public constant BRONZE_NUGGET_PROBABILITY = 100;
    uint256 public constant SILVER_NUGGET_PROBABILITY = 200;
    uint256 public constant GOLD_NUGGET_PROBABILITY = 300;
    uint256 public constant PLATINUM_NUGGET_PROBABILITY = 400;
    uint256 public constant DIAMOND_NUGGET_PROBABILITY = 500;
    uint256 public constant EMERALD_VEIN_PROBABILITY = 600;
    uint256 public constant RUBY_VEIN_PROBABILITY = 700;
    uint256 public constant SAPPHIRE_VEIN_PROBABILITY = 800;
    uint256 public constant CRYSTAL_CACHE_PROBABILITY = 900;
    uint256 public constant MOTHERLODE_PROBABILITY = 1000;

    /// @notice Claim fee (10%)
    uint256 public constant CLAIM_FEE_BPS = 1000;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice BTB token contract
    IERC20 public btbToken;

    /// @notice Treasury address
    address public treasuryAddress;

    /// @notice Bonding curve contract
    address public bondingCurveAddress;

    /// @notice Mining start timestamp
    uint256 public startTime;

    /// @notice Mining end timestamp
    uint256 public endTime;

    /// @notice Initialization flag
    bool private initialized;

    /// @notice Current round ID
    uint256 public currentRoundId;

    /// @notice Configurable round duration
    uint256 public roundDuration;

    /// @notice Reward tracking
    uint256 public totalUnclaimedBTB;
    uint256 public totalRefinedBTB;
    uint256 public rewardsFactor;

    /// @notice Motherlode pots (10 tiers)
    uint256 public bronzeNuggetPot;
    uint256 public silverNuggetPot;
    uint256 public goldNuggetPot;
    uint256 public platinumNuggetPot;
    uint256 public diamondNuggetPot;
    uint256 public emeraldVeinPot;
    uint256 public rubyVeinPot;
    uint256 public sapphireVeinPot;
    uint256 public crystalCachePot;
    uint256 public motherloadePot;

    /*//////////////////////////////////////////////////////////////
                        REFERRAL SYSTEM STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Partner fee percentages (in basis points)
    uint256 public constant USER_CASHBACK_BPS = 100;    // 1% cashback to user
    uint256 public constant PARTNER_COMMISSION_BPS = 400; // 4% to partner
    uint256 public constant REDUCED_ADMIN_FEE_BPS = 500;  // 5% to admin (reduced from 10%)

    /// @notice Partner information
    struct Partner {
        bool isWhitelisted;           // Whether partner is active
        string name;                  // Partner name/identifier
        uint256 accumulatedFees;      // Accumulated fees for this partner
        uint256 totalReferrals;       // Total number of users referred
        uint256 totalVolumeReferred;  // Total ETH volume from referrals
    }

    /// @notice Mapping from partner address to partner info
    mapping(address => Partner) public partners;

    /// @notice Array of all partner addresses (for enumeration)
    address[] public partnerList;

    /*//////////////////////////////////////////////////////////////
                        CHAINLINK VRF STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Chainlink VRF Coordinator
    IVRFCoordinatorV2Plus public vrfCoordinator;

    /// @notice Chainlink VRF subscription ID
    uint256 public vrfSubscriptionId;

    /// @notice Chainlink VRF key hash
    bytes32 public vrfKeyHash;

    /// @notice Chainlink VRF callback gas limit
    uint32 public vrfCallbackGasLimit;

    /// @notice Chainlink VRF request confirmations
    uint16 public vrfRequestConfirmations;

    /// @notice Mapping from VRF request ID to round ID
    mapping(uint256 => uint256) public vrfRequestToRound;

    /// @notice Pending VRF request for current round
    uint256 public pendingVRFRequest;

    /*//////////////////////////////////////////////////////////////
                              ROUND STATE
    //////////////////////////////////////////////////////////////*/

    struct Round {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256[NUM_SQUARES] deployed; // Total ETH deployed per square
        uint256[NUM_SQUARES] minerCount; // Number of miners per square
        uint256 totalDeployed; // Total ETH in this round
        bytes32 entropyHash; // Hash for randomness
        uint256 totalWinnings; // Total ETH won
        uint256 btbReward; // BTB reward for this round
        uint256 totalMotherlodeReward; // Total bonus BTB from all motherlode hits
        // Packed slot: uint8 + uint16 + 5 bools = 8 bytes in one slot (saves 3 slots!)
        uint8 winningSquare; // Winning square (0-24)
        uint16 motherlodeTiersHit; // Bitmask of which tiers were hit (0-9)
        bool finalized; // Whether round ended and winner selected
        bool isCheckpointable; // Whether miners can checkpoint
        bool isJackpotRound; // Whether this is a jackpot boost round (50/50 chance)
        bool timerStarted; // Whether timer has been started by first deployment
        bool finalizationRequested; // Whether VRF finalization has been requested (prevents duplicate requests)
    }

    struct MinerRoundData {
        uint256[NUM_SQUARES] deployed;
        bool hasCheckpointed;
        uint256 rewardsETH;
        uint256 rewardsBTB;
        uint256 refinedBTB;
        uint256 lastRewardsFactor;
    }

    struct MinerStats {
        uint256 unclaimedETH; // ETH earned but not yet claimed (rewards + cashback)
        uint256 unclaimedBTB; // BTB earned but not yet claimed
        uint256 refinedBTB; // BTB earned from claim fees
        uint256 lastRewardsFactor; // Last rewards factor
    }

    /// @notice Round data
    mapping(uint256 => Round) public rounds;

    /// @notice Miner data per round
    mapping(uint256 => mapping(address => MinerRoundData)) public minerData;

    /// @notice Miner global statistics
    mapping(address => MinerStats) public minerStats;

    /// @notice Rounds that each miner has participated in
    mapping(address => uint256[]) public minerParticipatedRounds;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);

    event VRFRequested(uint256 indexed roundId, uint256 indexed requestId);
    event RandomnessReceived(uint256 indexed roundId, uint256 indexed requestId, uint256 randomness);

    event Deployed(
        uint256 indexed roundId,
        address indexed miner,
        uint8[] squares,
        uint256 amountPerSquare,
        uint256 totalAmount
    );

    event RoundFinalized(
        uint256 indexed roundId,
        uint8 winningSquare,
        uint256 totalWinnings,
        uint256 btbReward,
        uint256 totalMotherlodeReward,
        uint16 motherlodeTiersHit
    );

    event Checkpointed(
        uint256 indexed roundId,
        address indexed miner,
        uint256 ethReward,
        uint256 btbReward,
        bool isWinner
    );

    event RewardsClaimed(
        address indexed miner,
        uint256 ethAmount,
        uint256 btbAmount,
        uint256 refinedBTB,
        uint256 claimFee
    );

    event MotherlodeHit(
        uint256 indexed roundId,
        uint8 indexed tier,
        string tierName,
        uint256 amount
    );

    event MotherlodePotsIncreased(uint256 indexed roundId);

    event BTBRefined(address indexed miner, uint256 refinedAmount);

    event RoundDataPruned(uint256 indexed roundId);

    event PartnerWhitelisted(address indexed partner, string name);
    event PartnerRemoved(address indexed partner);
    event ReferralApplied(address indexed user, address indexed partner, uint256 partnerCommission, uint256 userCashback);
    event PartnerFeesWithdrawn(address indexed partner, address indexed recipient, uint256 amount);
    event TreasuryWithdrawal(uint256 totalWithdrawn, uint256 toMotherlode, uint256 toRewards);
    event TreasuryAddressSet(address indexed oldTreasury, address indexed newTreasury);
    event BondingCurveAddressSet(address indexed oldBondingCurve, address indexed newBondingCurve);
    event AdminFeesSentToBondingCurve(uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error MiningNotStarted();
    error MiningEnded();
    error RoundNotActive();
    error RoundNotFinalized();
    error RoundAlreadyFinalized();
    error InvalidSquare();
    error InvalidDeployment();
    error InsufficientPayment();
    error AlreadyCheckpointed();
    error NoRewardsToClaim();
    error TransferFailed();
    error VRFRequestPending();
    error RoundNotReadyForVRF();
    error Unauthorized();
    error PartnerAlreadyWhitelisted();
    error PartnerNotWhitelisted();
    error InvalidPartner();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _btbToken,
        address _vrfCoordinator
    ) Ownable(msg.sender) {
        btbToken = IERC20(_btbToken);
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
        startTime = block.timestamp;
        endTime = startTime + MINING_DURATION;

        // Default round duration
        roundDuration = DEFAULT_ROUND_DURATION;

        // Default VRF settings (can be updated by owner)
        vrfCallbackGasLimit = 500000;
        vrfRequestConfirmations = 3;

        // Start first round
        _startNewRound();
    }

    /**
     * @notice Initialize the contract (for proxy deployments)
     * @param _owner Owner address
     * @param _btbToken BTB token address
     * @param _vrfCoordinator VRF Coordinator address
     */
    function initialize(address _owner, address _btbToken, address _vrfCoordinator) external {
        require(!initialized, "Already initialized");
        require(_owner != address(0), "Invalid owner");
        require(_btbToken != address(0), "Invalid BTB token");
        require(_vrfCoordinator != address(0), "Invalid VRF coordinator");

        initialized = true;
        _transferOwnership(_owner);

        btbToken = IERC20(_btbToken);
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);

        startTime = block.timestamp;
        endTime = startTime + MINING_DURATION;

        // Default round duration
        roundDuration = DEFAULT_ROUND_DURATION;

        // Start first round
        _startNewRound();
    }

    /*//////////////////////////////////////////////////////////////
                            DEPLOYMENT LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deploy ETH to one or more squares
     * @param squares Array of square indices (0-24) to deploy to
     * @param amountPerSquare Amount of ETH to deploy per square
     * @param partner Partner address for referral (address(0) for no partner)
     */
    function deploy(uint8[] calldata squares, uint256 amountPerSquare, address partner)
        external
        payable
        nonReentrant
    {
        if (block.timestamp < startTime) revert MiningNotStarted();
        if (block.timestamp >= endTime) revert MiningEnded();

        Round storage round = rounds[currentRoundId];

        // Note: Round finalization is now handled by Chainlink Automation automatically
        // No need to auto-finalize here

        // If this is the first deployment in the round, start the timer
        if (!round.timerStarted) {
            // Reset round timer to start from now
            round.startTime = block.timestamp;
            round.endTime = block.timestamp + roundDuration;
            round.timerStarted = true;
        }

        if (block.timestamp < round.startTime || block.timestamp >= round.endTime) {
            revert RoundNotActive();
        }

        if (squares.length == 0 || squares.length > NUM_SQUARES) revert InvalidDeployment();
        if (amountPerSquare < MIN_DEPLOYMENT || amountPerSquare > MAX_DEPLOYMENT_PER_SQUARE) {
            revert InvalidDeployment();
        }

        MinerRoundData storage minerRound = minerData[currentRoundId][msg.sender];

        // Validate uniqueness and check for already-deployed squares BEFORE processing
        uint256 validSquaresCount = 0;
        for (uint256 i = 0; i < squares.length; i++) {
            uint8 square = squares[i];
            if (square >= NUM_SQUARES) revert InvalidSquare();

            // Check if already deployed to this square
            if (minerRound.deployed[square] == 0) {
                // Check for duplicates in the input array
                for (uint256 j = i + 1; j < squares.length; j++) {
                    if (squares[j] == square) revert InvalidDeployment();
                }
                validSquaresCount++;
            }
        }

        if (validSquaresCount == 0) revert InvalidDeployment();

        uint256 totalRequired = amountPerSquare * validSquaresCount;
        if (msg.value < totalRequired) revert InsufficientPayment();

        // Calculate fees based on partner parameter
        uint256 adminFee;
        uint256 partnerCommission;
        uint256 userCashback;
        uint256 gamePotAmount;

        if (partner != address(0) && partners[partner].isWhitelisted) {
            // Partner referral: 1% cashback + 4% partner + 5% admin = 10% total
            userCashback = (totalRequired * USER_CASHBACK_BPS) / BPS_DENOMINATOR;
            partnerCommission = (totalRequired * PARTNER_COMMISSION_BPS) / BPS_DENOMINATOR;
            adminFee = (totalRequired * REDUCED_ADMIN_FEE_BPS) / BPS_DENOMINATOR;
            gamePotAmount = totalRequired - userCashback - partnerCommission - adminFee;

            // Distribute fees
            partners[partner].accumulatedFees += partnerCommission;
            partners[partner].totalVolumeReferred += totalRequired;
            partners[partner].totalReferrals++; // Increment per transaction

            // Send admin fee to bonding curve immediately
            if (adminFee > 0 && bondingCurveAddress != address(0)) {
                (bool success, ) = bondingCurveAddress.call{value: adminFee}("");
                if (success) {
                    emit AdminFeesSentToBondingCurve(adminFee);
                }
            }

            // Store cashback in user's balance
            if (userCashback > 0) {
                minerStats[msg.sender].unclaimedETH += userCashback;
            }

            emit ReferralApplied(msg.sender, partner, partnerCommission, userCashback);
        } else {
            // No partner: standard 10% admin fee
            adminFee = (totalRequired * ADMIN_FEE_BPS) / BPS_DENOMINATOR;
            gamePotAmount = totalRequired - adminFee;

            // Send admin fee to bonding curve immediately
            if (adminFee > 0 && bondingCurveAddress != address(0)) {
                (bool success, ) = bondingCurveAddress.call{value: adminFee}("");
                if (success) {
                    emit AdminFeesSentToBondingCurve(adminFee);
                }
            }
        }

        uint256 amountPerSquareAfterFee = gamePotAmount / validSquaresCount;

        // Track if this is user's first deployment in this round
        bool isFirstDeployment = true;
        for (uint256 i = 0; i < NUM_SQUARES; i++) {
            if (minerRound.deployed[i] > 0) {
                isFirstDeployment = false;
                break;
            }
        }

        // Deploy to each valid square (using 90% amount after admin fee)
        for (uint256 i = 0; i < squares.length; i++) {
            uint8 square = squares[i];

            // Skip if already deployed to this square
            if (minerRound.deployed[square] > 0) continue;

            // Update deployments (90% after admin fee)
            minerRound.deployed[square] = amountPerSquareAfterFee;
            round.deployed[square] += amountPerSquareAfterFee;
            round.totalDeployed += amountPerSquareAfterFee;
            round.minerCount[square]++;
        }

        // Track participation for efficient claiming later
        if (isFirstDeployment) {
            minerParticipatedRounds[msg.sender].push(currentRoundId);
        }

        // Refund excess
        if (msg.value > totalRequired) {
            (bool success, ) = msg.sender.call{value: msg.value - totalRequired}("");
            if (!success) revert TransferFailed();
        }

        emit Deployed(currentRoundId, msg.sender, squares, amountPerSquareAfterFee, gamePotAmount);

        // Auto-checkpoint past rounds AFTER deploy completes (prevents reentrancy)
        _autoCheckpointAllRounds(msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                          ROUND FINALIZATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Finalize current round and select winner
     * @dev Can be called by anyone after round ends
     */
    /**
     * @notice Request VRF randomness to finalize round
     * @dev This function requests Chainlink VRF randomness. The round will be finalized in fulfillRandomWords callback
     */
    function finalizeRound() external nonReentrant {
        Round storage round = rounds[currentRoundId];

        if (block.timestamp < round.endTime) revert RoundNotActive();
        if (round.finalized) revert RoundAlreadyFinalized();
        if (round.finalizationRequested) revert VRFRequestPending(); // Prevent duplicate requests
        if (pendingVRFRequest != 0) revert VRFRequestPending();

        // VRF must be configured - no fallback to weak randomness
        require(vrfSubscriptionId != 0, "VRF not configured");

        // Mark finalization as requested to prevent duplicate calls
        round.finalizationRequested = true;

        // Use Chainlink VRF for provably fair randomness
        uint256 requestId = vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: vrfKeyHash,
                subId: vrfSubscriptionId,
                requestConfirmations: vrfRequestConfirmations,
                callbackGasLimit: vrfCallbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        vrfRequestToRound[requestId] = currentRoundId;
        pendingVRFRequest = requestId;

        emit VRFRequested(currentRoundId, requestId);
    }

    /**
     * @notice Chainlink VRF callback
     * @dev Called by VRF Coordinator with random number
     */
    /// @notice Callback function called by VRF Coordinator with random values
    /// @dev Only callable by the VRF Coordinator contract
    /// @param requestId The VRF request ID
    /// @param randomWords Array of random values from Chainlink VRF
    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) external {
        // Only VRF Coordinator can call this
        if (msg.sender != address(vrfCoordinator)) revert Unauthorized();

        uint256 roundId = vrfRequestToRound[requestId];
        if (roundId == 0) return;

        emit RandomnessReceived(roundId, requestId, randomWords[0]);

        // Clear pending request
        delete vrfRequestToRound[requestId];
        if (pendingVRFRequest == requestId) {
            pendingVRFRequest = 0;
        }

        // Finalize the round with VRF randomness
        _finalizeRoundWithRandomness(randomWords[0]);

        // Start next round
        _startNewRound();
    }

    /**
     * @notice Finalize round with provided randomness
     * @param randomness Random number from VRF
     */
    function _finalizeRoundWithRandomness(uint256 randomness) internal {
        Round storage round = rounds[currentRoundId];

        if (round.finalized) return;

        // Select winning square using VRF randomness
        round.winningSquare = uint8(randomness % NUM_SQUARES);

        // Calculate total winnings (all losing squares)
        uint256 totalWinnings = 0;
        for (uint256 i = 0; i < NUM_SQUARES; i++) {
            if (i != round.winningSquare) {
                totalWinnings += round.deployed[i];
            }
        }

        round.totalWinnings = totalWinnings;

        // Calculate BTB reward for this round
        round.btbReward = _calculateRoundBTBReward();

        // Check all 10 motherlode tiers (using different parts of randomness)
        uint256 totalMotherlodeReward = 0;
        uint16 tiersHit = 0;

        // Use keccak hash of randomness for each tier check to get independent randomness
        uint256 seed = randomness;

        // Tier 1: Bronze Nugget (1 in 100)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(1)))) % BRONZE_NUGGET_PROBABILITY) == 0 && bronzeNuggetPot > 0) {
            totalMotherlodeReward += bronzeNuggetPot;
            tiersHit |= (1 << 0);
            emit MotherlodeHit(round.id, 1, "Bronze Nugget", bronzeNuggetPot);
            bronzeNuggetPot = 0;
        }

        // Tier 2: Silver Nugget (1 in 200)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(2)))) % SILVER_NUGGET_PROBABILITY) == 0 && silverNuggetPot > 0) {
            totalMotherlodeReward += silverNuggetPot;
            tiersHit |= (1 << 1);
            emit MotherlodeHit(round.id, 2, "Silver Nugget", silverNuggetPot);
            silverNuggetPot = 0;
        }

        // Tier 3: Gold Nugget (1 in 300)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(3)))) % GOLD_NUGGET_PROBABILITY) == 0 && goldNuggetPot > 0) {
            totalMotherlodeReward += goldNuggetPot;
            tiersHit |= (1 << 2);
            emit MotherlodeHit(round.id, 3, "Gold Nugget", goldNuggetPot);
            goldNuggetPot = 0;
        }

        // Tier 4: Platinum Nugget (1 in 400)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(4)))) % PLATINUM_NUGGET_PROBABILITY) == 0 && platinumNuggetPot > 0) {
            totalMotherlodeReward += platinumNuggetPot;
            tiersHit |= (1 << 3);
            emit MotherlodeHit(round.id, 4, "Platinum Nugget", platinumNuggetPot);
            platinumNuggetPot = 0;
        }

        // Tier 5: Diamond Nugget (1 in 500)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(5)))) % DIAMOND_NUGGET_PROBABILITY) == 0 && diamondNuggetPot > 0) {
            totalMotherlodeReward += diamondNuggetPot;
            tiersHit |= (1 << 4);
            emit MotherlodeHit(round.id, 5, "Diamond Nugget", diamondNuggetPot);
            diamondNuggetPot = 0;
        }

        // Tier 6: Emerald Vein (1 in 600)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(6)))) % EMERALD_VEIN_PROBABILITY) == 0 && emeraldVeinPot > 0) {
            totalMotherlodeReward += emeraldVeinPot;
            tiersHit |= (1 << 5);
            emit MotherlodeHit(round.id, 6, "Emerald Vein", emeraldVeinPot);
            emeraldVeinPot = 0;
        }

        // Tier 7: Ruby Vein (1 in 700)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(7)))) % RUBY_VEIN_PROBABILITY) == 0 && rubyVeinPot > 0) {
            totalMotherlodeReward += rubyVeinPot;
            tiersHit |= (1 << 6);
            emit MotherlodeHit(round.id, 7, "Ruby Vein", rubyVeinPot);
            rubyVeinPot = 0;
        }

        // Tier 8: Sapphire Vein (1 in 800)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(8)))) % SAPPHIRE_VEIN_PROBABILITY) == 0 && sapphireVeinPot > 0) {
            totalMotherlodeReward += sapphireVeinPot;
            tiersHit |= (1 << 7);
            emit MotherlodeHit(round.id, 8, "Sapphire Vein", sapphireVeinPot);
            sapphireVeinPot = 0;
        }

        // Tier 9: Crystal Cache (1 in 900)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(9)))) % CRYSTAL_CACHE_PROBABILITY) == 0 && crystalCachePot > 0) {
            totalMotherlodeReward += crystalCachePot;
            tiersHit |= (1 << 8);
            emit MotherlodeHit(round.id, 9, "Crystal Cache", crystalCachePot);
            crystalCachePot = 0;
        }

        // Tier 10: Motherlode (1 in 1000)
        if ((uint256(keccak256(abi.encodePacked(seed, uint256(10)))) % MOTHERLODE_PROBABILITY) == 0 && motherloadePot > 0) {
            totalMotherlodeReward += motherloadePot;
            tiersHit |= (1 << 9);
            emit MotherlodeHit(round.id, 10, "MOTHERLODE", motherloadePot);
            motherloadePot = 0;
        }

        round.totalMotherlodeReward = totalMotherlodeReward;
        round.motherlodeTiersHit = tiersHit;

        // Check if winning square is empty (nobody deployed there)
        if (round.deployed[round.winningSquare] == 0) {
            // Winning square is empty - send all ETH and BTB to bonding curve
            uint256 totalETH = round.totalDeployed;
            uint256 totalBTB = round.btbReward + totalMotherlodeReward;

            if (totalETH > 0 && bondingCurveAddress != address(0)) {
                // Send ETH to bonding curve
                (bool success, ) = bondingCurveAddress.call{value: totalETH}("");
                require(success, "ETH transfer to bonding curve failed");
            }

            if (totalBTB > 0 && bondingCurveAddress != address(0)) {
                // Send BTB to bonding curve
                SafeERC20.safeTransfer(btbToken, bondingCurveAddress, totalBTB);
                totalUnclaimedBTB -= totalBTB; // Adjust tracking since BTB is sent out
            }

            // Set rewards to 0 since they were sent to bonding curve
            round.btbReward = 0;
            round.totalMotherlodeReward = 0;
            round.totalWinnings = 0;
        }

        round.finalized = true;
        round.isCheckpointable = true;

        emit RoundFinalized(
            round.id,
            round.winningSquare,
            totalWinnings,
            round.btbReward,
            totalMotherlodeReward,
            tiersHit
        );
    }

    /*//////////////////////////////////////////////////////////////
                          CHECKPOINT & CLAIMS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Checkpoint rewards from a completed round
     * @param roundId Round to checkpoint
     */
    function checkpoint(uint256 roundId) external nonReentrant {
        Round storage round = rounds[roundId];

        if (!round.finalized) revert RoundNotFinalized();
        if (!round.isCheckpointable) revert RoundNotFinalized();

        MinerRoundData storage minerRound = minerData[roundId][msg.sender];

        if (minerRound.hasCheckpointed) revert AlreadyCheckpointed();

        uint256 ethReward = 0;
        uint256 btbReward = 0;
        bool isWinner = false;

        uint8 winningSquare = round.winningSquare;

        // Check if miner deployed to winning square
        if (minerRound.deployed[winningSquare] > 0) {
            isWinner = true;

            // ETH rewards: original deployment + proportional share of winnings
            uint256 originalDeployment = minerRound.deployed[winningSquare];

            ethReward = originalDeployment;

            // Add proportional share of total winnings
            if (round.deployed[winningSquare] > 0) {
                uint256 share = (round.totalWinnings * originalDeployment) / round.deployed[winningSquare];
                ethReward += share;
            }

            // BTB rewards: split among all winners proportionally
            if (round.deployed[winningSquare] > 0 && round.btbReward > 0) {
                btbReward = (round.btbReward * originalDeployment) / round.deployed[winningSquare];
            }

            // Motherlode bonus if any tiers were hit
            if (round.totalMotherlodeReward > 0 && round.deployed[winningSquare] > 0) {
                uint256 motherlodeShare = (round.totalMotherlodeReward * originalDeployment) / round.deployed[winningSquare];
                btbReward += motherlodeShare;
            }

            // totalRoundsWon tracking removed - use off-chain indexing
        } else {
            // Loser - no rewards (their ETH was distributed to winners)
            ethReward = 0;
            btbReward = 0;
        }

        minerRound.hasCheckpointed = true;
        minerRound.rewardsETH = ethReward;
        minerRound.rewardsBTB = btbReward;

        // Delete deployed array to get gas refund (no longer needed after checkpoint)
        delete minerRound.deployed;

        // Update miner stats - accumulate unclaimed rewards
        MinerStats storage stats = minerStats[msg.sender];
        stats.unclaimedETH += ethReward;
        stats.unclaimedBTB += btbReward;
        totalUnclaimedBTB += btbReward;

        // Stats removed - use off-chain event indexing for totalETHEarned

        // Emit event
        emit Checkpointed(roundId, msg.sender, ethReward, btbReward, isWinner);
    }

    /**
     * @notice Claim accumulated BTB rewards (with 10% fee that goes to unclaimed miners)
     * @dev Automatically checkpoints all unclaimed rounds, then claims BTB
     */
    function claimBTB() external nonReentrant {
        // First, checkpoint all unclaimed rounds automatically
        _autoCheckpointAllRounds(msg.sender);

        MinerStats storage stats = minerStats[msg.sender];

        // Update refined rewards from claim fees
        _updateRefinedRewards(msg.sender);

        uint256 unclaimedBTB = stats.unclaimedBTB;
        uint256 refinedBTB = stats.refinedBTB;
        uint256 totalToClaim = unclaimedBTB + refinedBTB;

        if (totalToClaim == 0) revert NoRewardsToClaim();

        // Calculate claim fee (10% of unclaimed BTB)
        uint256 claimFee = 0;
        uint256 unclaimedAfterFee = unclaimedBTB;

        if (totalUnclaimedBTB > 0 && unclaimedBTB > 0) {
            claimFee = (unclaimedBTB * CLAIM_FEE_BPS) / BPS_DENOMINATOR;
            unclaimedAfterFee = unclaimedBTB - claimFee;

            // Add claim fee to rewards factor (shared among all unclaimed miners)
            uint256 rewardsPerToken = (claimFee * 1e18) / totalUnclaimedBTB;
            rewardsFactor += rewardsPerToken;
            totalRefinedBTB += claimFee;
        }

        // Reset miner stats
        stats.unclaimedBTB = 0;
        stats.refinedBTB = 0;
        stats.lastRewardsFactor = rewardsFactor;

        // Update global stats
        totalUnclaimedBTB -= unclaimedBTB;
        if (refinedBTB > 0) {
            totalRefinedBTB -= refinedBTB;
        }

        // totalBTBEarned tracking removed - use off-chain indexing

        // Transfer BTB
        uint256 finalAmount = unclaimedAfterFee + refinedBTB;
        btbToken.safeTransfer(msg.sender, finalAmount);

        emit RewardsClaimed(msg.sender, 0, unclaimedAfterFee, refinedBTB, claimFee);
    }

    /**
     * @notice Claim accumulated ETH rewards only
     * @dev Automatically checkpoints all unclaimed rounds, then withdraws ETH
     */
    function claimETH() external nonReentrant {
        // First, checkpoint all unclaimed rounds automatically
        _autoCheckpointAllRounds(msg.sender);

        MinerStats storage stats = minerStats[msg.sender];
        uint256 ethToClaim = stats.unclaimedETH;

        if (ethToClaim == 0) revert NoRewardsToClaim();

        // Reset ETH balance
        stats.unclaimedETH = 0;

        // Transfer ETH
        (bool success, ) = msg.sender.call{value: ethToClaim}("");
        if (!success) revert TransferFailed();

        emit RewardsClaimed(msg.sender, ethToClaim, 0, 0, 0);
    }

    /**
     * @notice Claim all rewards (ETH + BTB) at once
     * @dev Automatically checkpoints all unclaimed rounds, then withdraws both
     */
    function claimAll() external nonReentrant {
        // First, checkpoint all unclaimed rounds automatically
        _autoCheckpointAllRounds(msg.sender);

        MinerStats storage stats = minerStats[msg.sender];

        // Update refined rewards from claim fees
        _updateRefinedRewards(msg.sender);

        uint256 ethToClaim = stats.unclaimedETH;
        uint256 unclaimedBTB = stats.unclaimedBTB;
        uint256 refinedBTB = stats.refinedBTB;
        uint256 totalBTBToClaim = unclaimedBTB + refinedBTB;

        if (ethToClaim == 0 && totalBTBToClaim == 0) revert NoRewardsToClaim();

        // Calculate BTB claim fee (10% of unclaimed BTB)
        uint256 claimFee = 0;
        uint256 unclaimedAfterFee = unclaimedBTB;

        if (totalUnclaimedBTB > 0 && unclaimedBTB > 0) {
            claimFee = (unclaimedBTB * CLAIM_FEE_BPS) / BPS_DENOMINATOR;
            unclaimedAfterFee = unclaimedBTB - claimFee;

            // Add claim fee to rewards factor (shared among all unclaimed miners)
            uint256 rewardsPerToken = (claimFee * 1e18) / totalUnclaimedBTB;
            rewardsFactor += rewardsPerToken;
            totalRefinedBTB += claimFee;
        }

        // Reset miner stats
        stats.unclaimedETH = 0;
        stats.unclaimedBTB = 0;
        stats.refinedBTB = 0;
        stats.lastRewardsFactor = rewardsFactor;

        // Update global stats
        totalUnclaimedBTB -= unclaimedBTB;
        if (refinedBTB > 0) {
            totalRefinedBTB -= refinedBTB;
        }

        // Transfer ETH
        if (ethToClaim > 0) {
            (bool success, ) = msg.sender.call{value: ethToClaim}("");
            if (!success) revert TransferFailed();
        }

        // Transfer BTB
        if (totalBTBToClaim > 0) {
            uint256 finalBTBAmount = unclaimedAfterFee + refinedBTB;
            btbToken.safeTransfer(msg.sender, finalBTBAmount);
        }

        emit RewardsClaimed(msg.sender, ethToClaim, unclaimedAfterFee, refinedBTB, claimFee);
    }

    /**
     * @notice Update refined rewards from claim fees
     * @param miner Address of miner
     */
    function _updateRefinedRewards(address miner) internal {
        MinerStats storage stats = minerStats[miner];

        if (stats.unclaimedBTB == 0) return;
        if (rewardsFactor <= stats.lastRewardsFactor) return;

        uint256 rewardsDelta = rewardsFactor - stats.lastRewardsFactor;
        uint256 refinedAmount = (stats.unclaimedBTB * rewardsDelta) / 1e18;

        if (refinedAmount > 0) {
            stats.refinedBTB += refinedAmount;
            emit BTBRefined(miner, refinedAmount);
        }

        stats.lastRewardsFactor = rewardsFactor;
    }

    /**
     * @notice Automatically checkpoint all unclaimed finalized rounds for a user
     * @param miner Address of miner
     * @dev Only loops through rounds where user participated, removes processed rounds from array
     */
    function _autoCheckpointAllRounds(address miner) internal {
        uint256[] storage participatedRounds = minerParticipatedRounds[miner];

        // Loop backwards so we can safely remove elements
        uint256 i = participatedRounds.length;
        while (i > 0) {
            i--;
            uint256 roundId = participatedRounds[i];
            Round storage round = rounds[roundId];

            // Skip if not finalized yet (keep in array for later)
            if (!round.finalized || !round.isCheckpointable) continue;

            MinerRoundData storage minerRound = minerData[roundId][miner];

            // If already checkpointed, remove from array (no longer needed)
            if (minerRound.hasCheckpointed) {
                // Remove by swapping with last element and popping
                participatedRounds[i] = participatedRounds[participatedRounds.length - 1];
                participatedRounds.pop();
                continue;
            }

            uint256 ethReward = 0;
            uint256 btbReward = 0;

            uint8 winningSquare = round.winningSquare;

            // Check if miner deployed to winning square
            if (minerRound.deployed[winningSquare] > 0) {
                // ETH rewards: original deployment + proportional share of winnings
                uint256 originalDeployment = minerRound.deployed[winningSquare];
                ethReward = originalDeployment;

                // Add proportional share of total winnings
                if (round.deployed[winningSquare] > 0) {
                    uint256 share = (round.totalWinnings * originalDeployment) / round.deployed[winningSquare];
                    ethReward += share;
                }

                // BTB rewards: split among all winners proportionally
                if (round.deployed[winningSquare] > 0 && round.btbReward > 0) {
                    btbReward = (round.btbReward * originalDeployment) / round.deployed[winningSquare];
                }

                // Motherlode bonus if any tiers were hit
                if (round.totalMotherlodeReward > 0 && round.deployed[winningSquare] > 0) {
                    uint256 motherlodeShare = (round.totalMotherlodeReward * originalDeployment) / round.deployed[winningSquare];
                    btbReward += motherlodeShare;
                }
            }

            // Mark as checkpointed
            minerRound.hasCheckpointed = true;
            minerRound.rewardsETH = ethReward;
            minerRound.rewardsBTB = btbReward;

            // Delete deployed array to get gas refund (no longer needed after checkpoint)
            delete minerRound.deployed;

            // Update miner stats - accumulate unclaimed rewards
            MinerStats storage stats = minerStats[miner];
            stats.unclaimedETH += ethReward;
            stats.unclaimedBTB += btbReward;
            totalUnclaimedBTB += btbReward;

            emit Checkpointed(roundId, miner, ethReward, btbReward, ethReward > 0);

            // Remove from array after processing (no longer needed in memory)
            participatedRounds[i] = participatedRounds[participatedRounds.length - 1];
            participatedRounds.pop();
        }
    }

    /**
     * @notice Prune old round data to prevent storage bloat
     * @dev Can be called by anyone to clean up rounds older than 100 rounds
     * @param roundId Round to prune (must be >100 rounds old and finalized)
     */
    function pruneRoundData(uint256 roundId) external {
        if (roundId >= currentRoundId - 100) revert("Round too recent");

        Round storage round = rounds[roundId];
        if (!round.finalized) revert RoundNotFinalized();

        // Delete the round data to refund gas
        delete rounds[roundId];

        emit RoundDataPruned(roundId);
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _startNewRound() internal {
        // Auto-withdraw 30,000 BTB from treasury BEFORE starting the round
        // This ensures tokens are available for the round being created
        // 10,000 BTB for motherlode pots + 20,000 BTB for user rewards
        if (treasuryAddress != address(0)) {
            uint256 toMotherlode = 10_000 * 10**18;  // 10,000 BTB
            uint256 toRewards = 20_000 * 10**18;     // 20,000 BTB
            uint256 totalWithdrawal = toMotherlode + toRewards;

            // Check if treasury has enough balance and approval
            uint256 treasuryBalance = btbToken.balanceOf(treasuryAddress);
            uint256 allowance = btbToken.allowance(treasuryAddress, address(this));

            if (treasuryBalance >= totalWithdrawal && allowance >= totalWithdrawal) {
                // Transfer from treasury to this contract
                // Note: SafeERC20 will revert on failure, but we wrap in a low-level check
                // to prevent round creation from failing
                btbToken.safeTransferFrom(treasuryAddress, address(this), totalWithdrawal);
                emit TreasuryWithdrawal(totalWithdrawal, toMotherlode, toRewards);
            }
            // If conditions not met, continue without error - contract will use existing balance
        }

        currentRoundId++;

        Round storage newRound = rounds[currentRoundId];
        newRound.id = currentRoundId;
        newRound.startTime = block.timestamp;
        newRound.endTime = block.timestamp + roundDuration;
        newRound.entropyHash = keccak256(
            abi.encodePacked(block.timestamp, block.prevrandao, currentRoundId)
        );
        newRound.finalized = false;
        newRound.isCheckpointable = false;

        // 50/50 chance: Normal round or Jackpot boost round
        // Use entropy hash to determine (50/50 = check if even/odd)
        newRound.isJackpotRound = (uint256(newRound.entropyHash) % 2 == 1);

        // Auto-increase all 10 motherlode pots each new round
        // Amount depends on round type (normal or jackpot boost)
        uint256 tierIncrease = newRound.isJackpotRound ? BTB_PER_MOTHERLODE_TIER_JACKPOT : BTB_PER_MOTHERLODE_TIER_NORMAL;

        bronzeNuggetPot += tierIncrease;      // Normal: +1k, Jackpot: +2k
        silverNuggetPot += tierIncrease;
        goldNuggetPot += tierIncrease;
        platinumNuggetPot += tierIncrease;
        diamondNuggetPot += tierIncrease;
        emeraldVeinPot += tierIncrease;
        rubyVeinPot += tierIncrease;
        sapphireVeinPot += tierIncrease;
        crystalCachePot += tierIncrease;
        motherloadePot += tierIncrease;

        emit MotherlodePotsIncreased(currentRoundId);
        emit RoundStarted(currentRoundId, newRound.startTime, newRound.endTime);
    }

    function _calculateRoundBTBReward() internal view returns (uint256) {
        if (block.timestamp >= endTime) return 0;

        Round storage round = rounds[currentRoundId];

        // Determine reward based on round type
        uint256 targetReward = round.isJackpotRound ? BTB_PER_ROUND_JACKPOT : BTB_PER_ROUND_NORMAL;

        // Check if we have enough BTB remaining
        uint256 contractBalance = btbToken.balanceOf(address(this));

        // Return target amount if available
        if (contractBalance >= targetReward) {
            return targetReward;
        }

        // If less remaining, return whatever is left
        return contractBalance;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getCurrentRound() external view returns (Round memory) {
        return rounds[currentRoundId];
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function getWinningSquare(uint256 roundId) external view returns (uint8) {
        return rounds[roundId].winningSquare;
    }

    function getMinerRoundData(uint256 roundId, address miner)
        external
        view
        returns (MinerRoundData memory)
    {
        return minerData[roundId][miner];
    }

    function getMinerStats(address /* miner */)
        external
        pure
        returns (
            uint256 ethEarned,
            uint256 btbEarned,
            uint256 roundsPlayed,
            uint256 roundsWon,
            uint256 winRate
        )
    {
        // ⚠️ DEPRECATED: These metrics were removed to save gas
        // Use off-chain indexing (The Graph/subgraph) to aggregate from events:
        // - Sum all Checkpointed.ethReward for ethEarned
        // - Sum all RewardsClaimed.btbAmount for btbEarned
        // - Count unique Deployed.roundId for roundsPlayed
        // - Count Checkpointed where isWinner=true for roundsWon
        return (0, 0, 0, 0, 0);
    }

    /**
     * @notice Get detailed miner BTB breakdown
     * @param miner Address to query
     * @return unclaimedBTB Unclaimed BTB (not yet withdrawn)
     * @return refinedBTB Refined BTB from claim fees
     * @return pendingRefined BTB being refined but not yet added
     * @return totalClaimable Total BTB available to claim
     */
    function getMinerBTBBreakdown(address miner)
        external
        view
        returns (
            uint256 unclaimedBTB,
            uint256 refinedBTB,
            uint256 pendingRefined,
            uint256 totalClaimable
        )
    {
        MinerStats storage stats = minerStats[miner];
        unclaimedBTB = stats.unclaimedBTB;
        refinedBTB = stats.refinedBTB;

        // Calculate pending refined rewards
        if (stats.unclaimedBTB > 0 && rewardsFactor > stats.lastRewardsFactor) {
            uint256 rewardsDelta = rewardsFactor - stats.lastRewardsFactor;
            pendingRefined = (stats.unclaimedBTB * rewardsDelta) / 1e18;
        }

        totalClaimable = unclaimedBTB + refinedBTB + pendingRefined;
    }

    /**
     * @notice Get total claimable balance including unclaimed rounds
     * @param miner Address of miner
     * @return totalETH Total ETH claimable (current balance + unclaimed rounds)
     * @return totalBTB Total BTB claimable (current balance + unclaimed rounds + refined)
     */
    function getTotalClaimableBalance(address miner)
        external
        view
        returns (uint256 totalETH, uint256 totalBTB)
    {
        MinerStats storage stats = minerStats[miner];
        totalETH = stats.unclaimedETH;
        totalBTB = stats.unclaimedBTB + stats.refinedBTB;

        // Add pending refined rewards
        if (stats.unclaimedBTB > 0 && rewardsFactor > stats.lastRewardsFactor) {
            uint256 rewardsDelta = rewardsFactor - stats.lastRewardsFactor;
            uint256 pendingRefined = (stats.unclaimedBTB * rewardsDelta) / 1e18;
            totalBTB += pendingRefined;
        }

        // Calculate rewards from unclaimed rounds
        uint256[] storage participatedRounds = minerParticipatedRounds[miner];
        for (uint256 i = 0; i < participatedRounds.length; i++) {
            uint256 roundId = participatedRounds[i];
            Round storage round = rounds[roundId];

            // Skip if not finalized yet
            if (!round.finalized || !round.isCheckpointable) continue;

            MinerRoundData storage minerRound = minerData[roundId][miner];

            // Skip if already checkpointed
            if (minerRound.hasCheckpointed) continue;

            uint8 winningSquare = round.winningSquare;

            // Check if miner deployed to winning square
            if (minerRound.deployed[winningSquare] > 0) {
                uint256 originalDeployment = minerRound.deployed[winningSquare];

                // Calculate ETH reward
                uint256 ethReward = originalDeployment;
                if (round.deployed[winningSquare] > 0) {
                    uint256 share = (round.totalWinnings * originalDeployment) / round.deployed[winningSquare];
                    ethReward += share;
                }
                totalETH += ethReward;

                // Calculate BTB reward
                if (round.deployed[winningSquare] > 0 && round.btbReward > 0) {
                    uint256 btbReward = (round.btbReward * originalDeployment) / round.deployed[winningSquare];

                    // Add motherlode bonus
                    if (round.totalMotherlodeReward > 0) {
                        uint256 motherlodeShare = (round.totalMotherlodeReward * originalDeployment) / round.deployed[winningSquare];
                        btbReward += motherlodeShare;
                    }

                    totalBTB += btbReward;
                }
            }
        }
    }

    function getSquareDeployment(uint256 roundId, uint8 square)
        external
        view
        returns (uint256 totalDeployed, uint256 minerCount)
    {
        if (square >= NUM_SQUARES) revert InvalidSquare();
        Round storage round = rounds[roundId];
        return (round.deployed[square], round.minerCount[square]);
    }

    function getCurrentRoundTimeRemaining() external view returns (uint256) {
        Round storage round = rounds[currentRoundId];
        if (block.timestamp >= round.endTime) return 0;
        return round.endTime - block.timestamp;
    }

    function estimateRewards(uint256 roundId, address miner, uint8 square)
        external
        view
        returns (uint256 estimatedETH, uint256 estimatedBTB)
    {
        Round storage round = rounds[roundId];
        MinerRoundData storage minerRound = minerData[roundId][miner];

        if (minerRound.deployed[square] == 0) return (0, 0);
        if (round.deployed[square] == 0) return (0, 0);

        // Estimate if this square wins
        uint256 totalWinnings = 0;
        for (uint256 i = 0; i < NUM_SQUARES; i++) {
            if (i != square) {
                totalWinnings += round.deployed[i];
            }
        }

        uint256 deployment = minerRound.deployed[square];

        // Admin fee taken from winner's deployment (1%)
        uint256 adminFee = (deployment * ADMIN_FEE_BPS) / BPS_DENOMINATOR;
        if (adminFee == 0 && deployment > 0) adminFee = 1;

        // Estimated ETH = (original - admin fee) + share of losing squares
        estimatedETH = (deployment - adminFee) + (totalWinnings * deployment) / round.deployed[square];

        uint256 btbReward = _calculateRoundBTBReward();
        estimatedBTB = (btbReward * deployment) / round.deployed[square];

        // Add expected value from all 10 motherlode tiers
        if (round.deployed[square] > 0) {
            // Each tier's expected value = (pot * deployment) / (probability * totalDeployed)
            if (bronzeNuggetPot > 0) {
                estimatedBTB += (bronzeNuggetPot * deployment) / (BRONZE_NUGGET_PROBABILITY * round.deployed[square]);
            }
            if (silverNuggetPot > 0) {
                estimatedBTB += (silverNuggetPot * deployment) / (SILVER_NUGGET_PROBABILITY * round.deployed[square]);
            }
            if (goldNuggetPot > 0) {
                estimatedBTB += (goldNuggetPot * deployment) / (GOLD_NUGGET_PROBABILITY * round.deployed[square]);
            }
            if (platinumNuggetPot > 0) {
                estimatedBTB += (platinumNuggetPot * deployment) / (PLATINUM_NUGGET_PROBABILITY * round.deployed[square]);
            }
            if (diamondNuggetPot > 0) {
                estimatedBTB += (diamondNuggetPot * deployment) / (DIAMOND_NUGGET_PROBABILITY * round.deployed[square]);
            }
            if (emeraldVeinPot > 0) {
                estimatedBTB += (emeraldVeinPot * deployment) / (EMERALD_VEIN_PROBABILITY * round.deployed[square]);
            }
            if (rubyVeinPot > 0) {
                estimatedBTB += (rubyVeinPot * deployment) / (RUBY_VEIN_PROBABILITY * round.deployed[square]);
            }
            if (sapphireVeinPot > 0) {
                estimatedBTB += (sapphireVeinPot * deployment) / (SAPPHIRE_VEIN_PROBABILITY * round.deployed[square]);
            }
            if (crystalCachePot > 0) {
                estimatedBTB += (crystalCachePot * deployment) / (CRYSTAL_CACHE_PROBABILITY * round.deployed[square]);
            }
            if (motherloadePot > 0) {
                estimatedBTB += (motherloadePot * deployment) / (MOTHERLODE_PROBABILITY * round.deployed[square]);
            }
        }
    }

    /**
     * @notice Get treasury information
     * @return totalUnclaimed Total BTB waiting to be claimed
     * @return totalRefined Total BTB earned from claim fees
     * @return currentRewardsFactor Current rewards factor for refinement
     */
    function getTreasuryInfo()
        external
        view
        returns (
            uint256 totalUnclaimed,
            uint256 totalRefined,
            uint256 currentRewardsFactor
        )
    {
        return (totalUnclaimedBTB, totalRefinedBTB, rewardsFactor);
    }

    /**
     * @notice Get all motherlode pot balances
     * @return pots Array of 10 motherlode pot amounts [Bronze, Silver, Gold, Platinum, Diamond, Emerald, Ruby, Sapphire, Crystal, Motherlode]
     */
    function getAllMotherloadePots()
        external
        view
        returns (uint256[NUM_MOTHERLODE_TIERS] memory pots)
    {
        pots[0] = bronzeNuggetPot;
        pots[1] = silverNuggetPot;
        pots[2] = goldNuggetPot;
        pots[3] = platinumNuggetPot;
        pots[4] = diamondNuggetPot;
        pots[5] = emeraldVeinPot;
        pots[6] = rubyVeinPot;
        pots[7] = sapphireVeinPot;
        pots[8] = crystalCachePot;
        pots[9] = motherloadePot;
    }

    /**
     * @notice Get motherlode tier information
     * @param tier Tier number (1-10)
     * @return name Tier name
     * @return currentPot Current pot amount
     * @return perRoundIncrease BTB added per round
     * @return probability Chance (1 in X)
     */
    function getMotherloadeTierInfo(uint8 tier)
        external
        view
        returns (
            string memory name,
            uint256 currentPot,
            uint256 perRoundIncrease,
            uint256 probability
        )
    {
        if (tier == 1) return ("Bronze Nugget", bronzeNuggetPot, BTB_PER_MOTHERLODE_TIER_NORMAL, BRONZE_NUGGET_PROBABILITY);
        if (tier == 2) return ("Silver Nugget", silverNuggetPot, BTB_PER_MOTHERLODE_TIER_NORMAL, SILVER_NUGGET_PROBABILITY);
        if (tier == 3) return ("Gold Nugget", goldNuggetPot, BTB_PER_MOTHERLODE_TIER_NORMAL, GOLD_NUGGET_PROBABILITY);
        if (tier == 4) return ("Platinum Nugget", platinumNuggetPot, BTB_PER_MOTHERLODE_TIER_NORMAL, PLATINUM_NUGGET_PROBABILITY);
        if (tier == 5) return ("Diamond Nugget", diamondNuggetPot, BTB_PER_MOTHERLODE_TIER_NORMAL, DIAMOND_NUGGET_PROBABILITY);
        if (tier == 6) return ("Emerald Vein", emeraldVeinPot, BTB_PER_MOTHERLODE_TIER_NORMAL, EMERALD_VEIN_PROBABILITY);
        if (tier == 7) return ("Ruby Vein", rubyVeinPot, BTB_PER_MOTHERLODE_TIER_NORMAL, RUBY_VEIN_PROBABILITY);
        if (tier == 8) return ("Sapphire Vein", sapphireVeinPot, BTB_PER_MOTHERLODE_TIER_NORMAL, SAPPHIRE_VEIN_PROBABILITY);
        if (tier == 9) return ("Crystal Cache", crystalCachePot, BTB_PER_MOTHERLODE_TIER_NORMAL, CRYSTAL_CACHE_PROBABILITY);
        if (tier == 10) return ("MOTHERLODE", motherloadePot, BTB_PER_MOTHERLODE_TIER_NORMAL, MOTHERLODE_PROBABILITY);
        revert("Invalid tier");
    }

    /**
     * @notice Check which motherlode tiers were hit in a round
     * @param roundId Round to check
     * @return tiersHit Array of 10 booleans indicating which tiers were hit
     */
    function getRoundMotherlodeHits(uint256 roundId)
        external
        view
        returns (bool[NUM_MOTHERLODE_TIERS] memory tiersHit)
    {
        Round storage round = rounds[roundId];
        uint16 mask = round.motherlodeTiersHit;

        for (uint8 i = 0; i < NUM_MOTHERLODE_TIERS; i++) {
            tiersHit[i] = (mask & (uint16(1) << i)) != 0;
        }
    }

    /**
     * @notice Get unminted token information from treasury
     * @return treasuryBalance BTB tokens in treasury (unminted/out of circulation)
     * @return contractBalance BTB tokens in contract (available for distribution)
     * @return totalDistributed Total BTB already distributed to users
     */
    function getTokenDistribution()
        external
        view
        returns (
            uint256 treasuryBalance,
            uint256 contractBalance,
            uint256 totalDistributed
        )
    {
        treasuryBalance = treasuryAddress != address(0) ? btbToken.balanceOf(treasuryAddress) : 0;
        contractBalance = btbToken.balanceOf(address(this));

        // Total distributed = Total supply - Treasury - Contract
        uint256 totalSupply = TOTAL_BTB_REWARDS;
        totalDistributed = totalSupply - treasuryBalance - contractBalance;
    }

    /**
     * @notice Get count of active automations
     */
    /*//////////////////////////////////////////////////////////////
                        BATCH DEPLOY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Batch deploy for multiple users (called by external bot)
     * @param users Array of user addresses to deploy for
     * @param squaresArray Array of square arrays (one per user)
     * @param amounts Array of ETH amounts per square (one per user)
     * @param partnersArray Array of partner addresses (one per user, address(0) for no partner)
     */
    function batchDeploy(
        address[] calldata users,
        uint8[][] calldata squaresArray,
        uint256[] calldata amounts,
        address[] calldata partnersArray
    ) external payable nonReentrant {
        if (block.timestamp < startTime) revert MiningNotStarted();
        if (block.timestamp >= endTime) revert MiningEnded();

        require(users.length == squaresArray.length && users.length == amounts.length && users.length == partnersArray.length, "Array length mismatch");
        require(users.length > 0, "Empty batch");

        Round storage round = rounds[currentRoundId];

        // If this is the first deployment in the round, start the timer
        if (!round.timerStarted) {
            // Reset round timer to start from now
            round.startTime = block.timestamp;
            round.endTime = block.timestamp + roundDuration;
            round.timerStarted = true;
        }

        if (block.timestamp < round.startTime || block.timestamp >= round.endTime) {
            revert RoundNotActive();
        }

        uint256 totalCost;
        uint256 totalFeesCollected;

        // Auto-checkpoint all users' past unclaimed rounds (for bot automation)
        for (uint256 i = 0; i < users.length; i++) {
            _autoCheckpointAllRounds(users[i]);
        }

        // Process each user's deployment
        for (uint256 i = 0; i < users.length; i++) {
            (uint256 userCost, uint256 userFees) = _processBatchDeployment(
                users[i],
                squaresArray[i],
                amounts[i],
                partnersArray[i]
            );
            totalCost += userCost;
            totalFeesCollected += userFees;
        }

        // Note: Admin fees are accumulated inside _processBatchDeployment
        // Partner commissions are also accumulated there
        // totalFeesCollected includes admin + partner + cashback for validation only

        // Verify payment
        if (msg.value < totalCost) revert InsufficientPayment();

        // Refund excess
        if (msg.value > totalCost) {
            (bool success, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Internal helper for processing single user in batch deployment
     */
    function _processBatchDeployment(
        address miner,
        uint8[] calldata squares,
        uint256 amountPerSquare,
        address partner
    ) internal returns (uint256 userCost, uint256 totalFeesCollected) {
        if (squares.length == 0 || squares.length > NUM_SQUARES) return (0, 0);
        if (amountPerSquare < MIN_DEPLOYMENT || amountPerSquare > MAX_DEPLOYMENT_PER_SQUARE) return (0, 0);

        MinerRoundData storage minerRound = minerData[currentRoundId][miner];

        // Count and deploy in single pass
        uint256 deployedCount;
        for (uint256 j = 0; j < squares.length; j++) {
            uint8 square = squares[j];
            if (square >= NUM_SQUARES || minerRound.deployed[square] > 0) continue;
            deployedCount++;
        }

        if (deployedCount == 0) return (0, 0);

        // Track if this is user's first deployment in this round
        bool isFirstDeployment = true;
        for (uint256 i = 0; i < NUM_SQUARES; i++) {
            if (minerRound.deployed[i] > 0) {
                isFirstDeployment = false;
                break;
            }
        }

        // Calculate amounts based on partner parameter
        userCost = amountPerSquare * deployedCount;
        uint256 perSquareAfterFee;

        if (partner != address(0) && partners[partner].isWhitelisted) {
            // Batch deploy partner referral: 5% partner + 5% admin = 10% total (NO user cashback)
            uint256 partnerCommission = (userCost * REDUCED_ADMIN_FEE_BPS) / BPS_DENOMINATOR; // 5%
            uint256 adminFee = (userCost * REDUCED_ADMIN_FEE_BPS) / BPS_DENOMINATOR; // 5%

            // Accumulate partner fees
            partners[partner].accumulatedFees += partnerCommission;
            partners[partner].totalVolumeReferred += userCost;
            partners[partner].totalReferrals++; // Increment per transaction

            // Send admin fee to bonding curve immediately
            if (adminFee > 0 && bondingCurveAddress != address(0)) {
                (bool success, ) = bondingCurveAddress.call{value: adminFee}("");
                if (success) {
                    emit AdminFeesSentToBondingCurve(adminFee);
                }
            }

            // Calculate game pot and per square amount
            perSquareAfterFee = (userCost - partnerCommission - adminFee) / deployedCount;
            totalFeesCollected = adminFee + partnerCommission;

            emit ReferralApplied(miner, partner, partnerCommission, 0); // 0 cashback for batch
        } else {
            // No partner: standard 10% admin fee
            uint256 adminFee = (userCost * ADMIN_FEE_BPS) / BPS_DENOMINATOR;

            // Send admin fee to bonding curve immediately
            if (adminFee > 0 && bondingCurveAddress != address(0)) {
                (bool success, ) = bondingCurveAddress.call{value: adminFee}("");
                if (success) {
                    emit AdminFeesSentToBondingCurve(adminFee);
                }
            }

            perSquareAfterFee = (userCost - adminFee) / deployedCount;
            totalFeesCollected = adminFee;
        }

        // Now deploy
        Round storage round = rounds[currentRoundId];
        for (uint256 j = 0; j < squares.length; j++) {
            uint8 square = squares[j];
            if (square >= NUM_SQUARES || minerRound.deployed[square] > 0) continue;

            minerRound.deployed[square] = perSquareAfterFee;
            round.deployed[square] += perSquareAfterFee;
            round.totalDeployed += perSquareAfterFee;
            round.minerCount[square]++;
        }

        // Track participation for efficient claiming later
        if (isFirstDeployment) {
            minerParticipatedRounds[miner].push(currentRoundId);
        }

        // Note: Motherload pot is auto-increased once per round in _startNewRound()
        // Do NOT add per deployment to prevent hyperinflation

        // Round tracking removed - use off-chain indexing

        emit Deployed(currentRoundId, miner, squares, perSquareAfterFee, perSquareAfterFee * deployedCount);
    }

    /**
     * @notice Chainlink Automation check if round needs finalization
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Empty bytes
     */
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        Round storage round = rounds[currentRoundId];

        // Check if round needs finalization (after 60 seconds)
        bool needsFinalization = block.timestamp >= round.endTime &&
                                !round.finalized &&
                                pendingVRFRequest == 0 &&
                                round.totalDeployed > 0;

        return (needsFinalization, "");
    }

    /**
     * @notice Perform upkeep (finalize round)
     */
    function performUpkeep(bytes calldata /* performData */) external {
        // Finalize the current round if needed
        try this.finalizeRound() {} catch {}
    }

    /*//////////////////////////////////////////////////////////////
                      PARTNER MANAGEMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Whitelist a partner for the referral program
     * @param partner Partner address to whitelist
     * @param name Partner name/identifier
     */
    function whitelistPartner(address partner, string calldata name) external onlyOwner {
        if (partner == address(0)) revert InvalidPartner();
        if (partners[partner].isWhitelisted) revert PartnerAlreadyWhitelisted();

        partners[partner].isWhitelisted = true;
        partners[partner].name = name;
        partnerList.push(partner);

        emit PartnerWhitelisted(partner, name);
    }

    /**
     * @notice Remove a partner from the whitelist
     * @param partner Partner address to remove
     */
    function removePartner(address partner) external onlyOwner {
        if (!partners[partner].isWhitelisted) revert PartnerNotWhitelisted();

        partners[partner].isWhitelisted = false;

        // Remove from partnerList array using swap & pop
        for (uint256 i = 0; i < partnerList.length; i++) {
            if (partnerList[i] == partner) {
                // Swap with last element
                partnerList[i] = partnerList[partnerList.length - 1];
                // Remove last element
                partnerList.pop();
                break;
            }
        }

        emit PartnerRemoved(partner);
    }

    /**
     * @notice Partner withdraws their accumulated fees
     * @param recipient Address to receive the fees
     */
    function withdrawPartnerFees(address recipient) external nonReentrant {
        if (recipient == address(0)) revert InvalidPartner();
        if (!partners[msg.sender].isWhitelisted) revert PartnerNotWhitelisted();

        uint256 amount = partners[msg.sender].accumulatedFees;
        require(amount > 0, "No fees to withdraw");

        partners[msg.sender].accumulatedFees = 0;

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        emit PartnerFeesWithdrawn(msg.sender, recipient, amount);
    }

    /**
     * @notice Get partner information
     * @param partner Partner address
     * @return isWhitelisted Whether partner is active
     * @return name Partner name
     * @return accumulatedFees Accumulated fees
     * @return totalReferrals Total number of users referred
     * @return totalVolumeReferred Total ETH volume from referrals
     */
    function getPartnerInfo(address partner)
        external
        view
        returns (
            bool isWhitelisted,
            string memory name,
            uint256 accumulatedFees,
            uint256 totalReferrals,
            uint256 totalVolumeReferred
        )
    {
        Partner storage p = partners[partner];
        return (
            p.isWhitelisted,
            p.name,
            p.accumulatedFees,
            p.totalReferrals,
            p.totalVolumeReferred
        );
    }

    /**
     * @notice Get all whitelisted partners
     * @return Array of partner addresses
     */
    function getAllPartners() external view returns (address[] memory) {
        return partnerList;
    }

    /*//////////////////////////////////////////////////////////////
                          ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Configure Chainlink VRF settings
     * @param _subscriptionId VRF subscription ID
     * @param _keyHash VRF key hash
     * @param _callbackGasLimit Gas limit for VRF callback
     * @param _requestConfirmations Number of confirmations for VRF
     */
    function setVRFConfig(
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations
    ) external onlyOwner {
        vrfSubscriptionId = _subscriptionId;
        vrfKeyHash = _keyHash;
        vrfCallbackGasLimit = _callbackGasLimit;
        vrfRequestConfirmations = _requestConfirmations;
    }

    /**
     * @notice Update round duration (applies to new rounds)
     * @param _newDuration New round duration in seconds
     */
    function setRoundDuration(uint256 _newDuration) external onlyOwner {
        require(_newDuration >= 30, "Duration too short"); // Minimum 30 seconds
        require(_newDuration <= 1 days, "Duration too long"); // Maximum 1 day
        roundDuration = _newDuration;
    }

    function emergencyWithdrawBTB(address recipient) external onlyOwner {
        require(block.timestamp > endTime, "Mining not ended");
        uint256 balance = btbToken.balanceOf(address(this));
        btbToken.safeTransfer(recipient, balance);
    }

    /**
     * @notice Emergency withdraw any stuck ETH in contract
     * @param recipient Address to receive ETH
     * @param amount Amount to withdraw
     * @dev Only for recovering stuck funds, admin fees are sent directly to bonding curve
     */
    function emergencyWithdrawETH(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Set bonding curve address
     * @param _bondingCurveAddress Address of the bonding curve contract
     */
    function setBondingCurveAddress(address _bondingCurveAddress) external onlyOwner {
        require(_bondingCurveAddress != address(0), "Invalid bonding curve address");
        address oldBondingCurve = bondingCurveAddress;
        bondingCurveAddress = _bondingCurveAddress;
        emit BondingCurveAddressSet(oldBondingCurve, _bondingCurveAddress);
    }

    function clearPendingVRFRequest() external onlyOwner {
        pendingVRFRequest = 0;
    }

    /**
     * @notice Set treasury address for unminted tokens
     * @param _treasuryAddress Address holding unminted tokens
     */
    function setTreasuryAddress(address _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury address");
        address oldTreasury = treasuryAddress;
        treasuryAddress = _treasuryAddress;
        emit TreasuryAddressSet(oldTreasury, _treasuryAddress);
    }

    /**
     * @notice Withdraw tokens from treasury for distribution
     * @dev Withdraws 30,000 BTB total: 10,000 to motherlode pots + 20,000 to contract for user rewards
     * This makes it transparent how many tokens are still unminted/not in circulation
     */
    function withdrawFromTreasury() external onlyOwner nonReentrant {
        require(treasuryAddress != address(0), "Treasury not set");

        uint256 toMotherlode = 10_000 * 10**18;  // 10,000 BTB for motherlode pots (1,000 each tier)
        uint256 toRewards = 20_000 * 10**18;     // 20,000 BTB for user rewards
        uint256 totalWithdrawal = toMotherlode + toRewards;

        // Transfer from treasury to this contract
        btbToken.safeTransferFrom(treasuryAddress, address(this), totalWithdrawal);

        // The 20,000 BTB for rewards stays in contract balance for distribution
        // The 10,000 BTB is conceptually allocated to motherlode pots
        // (they increase automatically per round in _startNewRound)

        emit TreasuryWithdrawal(totalWithdrawal, toMotherlode, toRewards);
    }

    receive() external payable {}
}