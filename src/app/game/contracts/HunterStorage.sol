// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title HunterStorage
 * @dev Stores core data structures, constants, and events for Hunter NFTs.
 */
contract HunterStorage {
    struct HunterPosition {
        uint96 creationTime;       // When the hunter was created
        uint96 lastFeedTime;       // Last time hunter was fed
        uint96 lastHuntTime;       // Last time hunter hunted
        uint128 power;             // Current hunting power (e.g., with 18 decimals)
        uint8 missedFeedings;      // Consecutive missed feedings
        bool inHibernation;        // Whether hunter is in hibernation
        uint96 recoveryStartTime;  // When hunter started recovery from hibernation
        uint128 totalHunted;        // Total amount of MiMo tokens hunted (e.g., with 18 decimals)
    }

    // Constants for Hunter mechanics
    uint256 public constant BASE_POWER = 20 * 10**18;  // 20 MiMo per day base power (assuming 18 decimals)
    uint256 public constant LIFESPAN = 365 days;       // Hunter lifespan
    uint256 public constant MISSED_FEEDING_PENALTY = 30; // 30% power reduction after hibernation (percentage points)
    uint256 public constant HIBERNATION_THRESHOLD = 7;   // 7 missed feedings causes hibernation
    uint256 public constant RECOVERY_PERIOD = 1 days;    // 24 hours to recover from hibernation
    uint256 public constant HUNT_COOLDOWN = 24 hours;    // Can hunt once every 24 hours
    uint256 public constant GROWTH_RATE = 200;          // 2% power increase for feeding (in basis points, e.g. 200 = 2%)

    // Hunter events
    event HunterCreated(uint256 indexed tokenId, address indexed owner, uint256 power);
    event HunterFed(uint256 indexed tokenId, uint256 newPower);
    event HunterHunted(uint256 indexed tokenId, uint256 amount, uint256 toOwner, uint256 burned, uint256 toLiquidity);
    event HunterHibernated(uint256 indexed tokenId);
    event HunterRecovered(uint256 indexed tokenId, uint256 newPower);

    // Mapping from token ID to HunterPosition struct
    mapping(uint256 => HunterPosition) public positions;
} 