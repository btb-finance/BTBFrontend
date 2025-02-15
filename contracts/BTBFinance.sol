// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BTBFinance is ERC20, ERC20Permit, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant SEQUENCER_ROLE = keccak256("SEQUENCER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    uint256 public constant VALIDATOR_STAKE = 100000 * 10**18; // 100,000 BTB
    uint256 public constant DISPUTE_WINDOW = 7 days;
    uint256 public constant MIN_BRIDGE_AMOUNT = 1000 * 10**18; // 1,000 BTB

    struct Validator {
        address addr;
        uint256 stake;
        uint256 lastActiveTime;
        bool isActive;
    }

    struct BridgeOperation {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        bool isProcessed;
    }

    mapping(address => Validator) public validators;
    mapping(bytes32 => BridgeOperation) public bridgeOperations;
    
    uint256 public totalStaked;
    uint256 public operationNonce;

    event ValidatorStaked(address indexed validator, uint256 amount);
    event ValidatorUnstaked(address indexed validator, uint256 amount);
    event BridgeInitiated(bytes32 indexed operationId, address indexed from, address indexed to, uint256 amount);
    event BridgeCompleted(bytes32 indexed operationId);
    event DisputeRaised(address indexed validator, bytes32 indexed operationId);

    constructor() ERC20("BTB Finance", "BTB") ERC20Permit("BTB Finance") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _mint(msg.sender, 100000000 * 10**decimals()); // 100M initial supply
    }

    // Validator Management
    function stakeAsValidator() external nonReentrant {
        require(!validators[msg.sender].isActive, "Already a validator");
        require(balanceOf(msg.sender) >= VALIDATOR_STAKE, "Insufficient balance");

        _transfer(msg.sender, address(this), VALIDATOR_STAKE);
        validators[msg.sender] = Validator({
            addr: msg.sender,
            stake: VALIDATOR_STAKE,
            lastActiveTime: block.timestamp,
            isActive: true
        });
        totalStaked += VALIDATOR_STAKE;

        _grantRole(VALIDATOR_ROLE, msg.sender);
        emit ValidatorStaked(msg.sender, VALIDATOR_STAKE);
    }

    function unstakeValidator() external nonReentrant {
        require(validators[msg.sender].isActive, "Not a validator");
        require(block.timestamp >= validators[msg.sender].lastActiveTime + DISPUTE_WINDOW, "Dispute window active");

        uint256 stakeAmount = validators[msg.sender].stake;
        validators[msg.sender].isActive = false;
        totalStaked -= stakeAmount;

        _transfer(address(this), msg.sender, stakeAmount);
        _revokeRole(VALIDATOR_ROLE, msg.sender);
        emit ValidatorUnstaked(msg.sender, stakeAmount);
    }

    // Bridge Operations
    function initiateBridge(address to, uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        bytes32 operationId = keccak256(abi.encodePacked(operationNonce++, msg.sender, to, amount));
        _transfer(msg.sender, address(this), amount);

        bridgeOperations[operationId] = BridgeOperation({
            from: msg.sender,
            to: to,
            amount: amount,
            timestamp: block.timestamp,
            isProcessed: false
        });

        emit BridgeInitiated(operationId, msg.sender, to, amount);
    }

    function completeBridge(bytes32 operationId) external onlyRole(BRIDGE_ROLE) nonReentrant {
        BridgeOperation storage operation = bridgeOperations[operationId];
        require(!operation.isProcessed, "Already processed");
        require(block.timestamp >= operation.timestamp + DISPUTE_WINDOW, "Dispute window active");

        operation.isProcessed = true;
        _transfer(address(this), operation.to, operation.amount);
        emit BridgeCompleted(operationId);
    }

    // Validator Dispute Resolution
    function raiseDispute(bytes32 operationId) external onlyRole(VALIDATOR_ROLE) {
        require(!bridgeOperations[operationId].isProcessed, "Operation already processed");
        require(validators[msg.sender].isActive, "Not an active validator");
        emit DisputeRaised(msg.sender, operationId);
    }

    // Admin Functions
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // View Functions
    function getValidatorInfo(address validator) external view returns (Validator memory) {
        return validators[validator];
    }

    function getBridgeOperation(bytes32 operationId) external view returns (BridgeOperation memory) {
        return bridgeOperations[operationId];
    }
}
