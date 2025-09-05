//SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./LeverageTokenContract.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract LeverageTokenFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    struct TokenInfo {
        address backingToken;      // Original token address (SHIB, PEPE, etc)
        address leverageContract;  // Deployed leverage contract
        string name;               // levSHIB, levPEPE, etc
        string symbol;             // LEVSHIB, LEVPEPE, etc
        uint256 deployedAt;        // Deployment timestamp
        bool active;               // Whether token is active
    }
    
    // Mapping from backing token address to token info
    mapping(address => TokenInfo) public listedTokens;
    
    // Array of all listed token addresses for enumeration
    address[] public tokenList;
    
    // Platform settings
    address public feeCollector;                 // Where trading fees go
    uint256 public platformFeeShare = 500;       // 5% of trading fees (out of 10000)
    
    // Authorized listers who can whitelist tokens
    mapping(address => bool) public authorizedListers;
    address[] public listerList;
    
    // Events
    event TokenWhitelisted(
        address indexed backingToken,
        address indexed leverageContract,
        string name,
        string symbol
    );
    
    event TokenDeactivated(address indexed backingToken);
    event TokenReactivated(address indexed backingToken);
    event TokenDeleted(address indexed backingToken);
    event FeeCollectorUpdated(address newCollector);
    event PlatformFeeShareUpdated(uint256 newShare);
    event LeverageContractFeeAddressUpdated(address indexed backingToken, address newFeeAddress);
    event AllLeverageContractsFeeAddressUpdated(address newFeeAddress);
    event BatchLeverageContractsFeeAddressUpdated(uint256 startIndex, uint256 endIndex, uint256 updatedCount, address newFeeAddress);
    event ListerAdded(address indexed lister);
    event ListerRemoved(address indexed lister);
    
    modifier onlyListerOrOwner() {
        require(
            msg.sender == owner() || authorizedListers[msg.sender], 
            "Only owner or authorized lister"
        );
        _;
    }
    
    constructor(address _feeCollector) Ownable(msg.sender) {
        require(_feeCollector != address(0), "Fee collector cannot be zero address");
        feeCollector = _feeCollector;
        // Owner is automatically a lister
        authorizedListers[msg.sender] = true;
        listerList.push(msg.sender);
    }
    
    /**
     * @notice Whitelist a new token and deploy its leverage contract (admin only)
     * @param backingToken Address of the token to whitelist (SHIB, PEPE, etc)
     * @param name Name for leverage token (e.g., "Leverage SHIB")
     * @param symbol Symbol for leverage token (e.g., "levSHIB")
     */
    function whitelistToken(
        address backingToken,
        string memory name,
        string memory symbol
    ) external onlyListerOrOwner nonReentrant {
        require(backingToken != address(0), "Backing token cannot be zero address");
        require(listedTokens[backingToken].backingToken == address(0), "Token already whitelisted");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        
        // Verify backing token is valid ERC20
        try IERC20Metadata(backingToken).decimals() returns (uint8) {
            // Token is valid
        } catch {
            revert("Invalid ERC20 token");
        }
        
        // Deploy new leverage contract
        LeverageToken leverageContract = new LeverageToken(backingToken, name, symbol);
        
        // Set this factory as the fee address for revenue sharing
        leverageContract.setFeeAddress(feeCollector);
        
        // Transfer 1 backing token from caller to initialize the contract
        IERC20(backingToken).safeTransferFrom(msg.sender, address(this), 1);
        
        // Approve the leverage contract to take the token
        IERC20(backingToken).approve(address(leverageContract), 1);
        
        // Initialize the leverage contract with 1 token amount and send 1 to factory owner
        leverageContract.setStart(1, 1);
        
        // Store token info
        listedTokens[backingToken] = TokenInfo({
            backingToken: backingToken,
            leverageContract: address(leverageContract),
            name: name,
            symbol: symbol,
            deployedAt: block.timestamp,
            active: true
        });
        
        // Add to token list for enumeration
        tokenList.push(backingToken);
        
        // Keep factory as owner so we can manage fee addresses
        // leverageContract ownership stays with factory
        
        emit TokenWhitelisted(
            backingToken,
            address(leverageContract),
            name,
            symbol
        );
    }
    
    /**
     * @notice Get leverage contract for a backing token
     */
    function getLeverageContract(address backingToken) external view returns (address) {
        require(listedTokens[backingToken].active, "Token not active");
        return listedTokens[backingToken].leverageContract;
    }
    
    /**
     * @notice Check if a token is whitelisted and active
     */
    function isTokenActive(address backingToken) external view returns (bool) {
        return listedTokens[backingToken].active;
    }
    
    /**
     * @notice Get full token info
     */
    function getTokenInfo(address backingToken) external view returns (TokenInfo memory) {
        return listedTokens[backingToken];
    }
    
    /**
     * @notice Get all whitelisted tokens
     */
    function getAllTokens() external view returns (address[] memory) {
        return tokenList;
    }
    
    /**
     * @notice Get all active tokens
     */
    function getActiveTokens() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active tokens
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (listedTokens[tokenList[i]].active) {
                activeCount++;
            }
        }
        
        // Create array of active tokens
        address[] memory activeTokens = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (listedTokens[tokenList[i]].active) {
                activeTokens[index] = tokenList[i];
                index++;
            }
        }
        
        return activeTokens;
    }
    
    /**
     * @notice Get total number of listed tokens
     */
    function getTokenCount() external view returns (uint256) {
        return tokenList.length;
    }
    
    // Admin functions
    
    /**
     * @notice Deactivate a token (admin only)
     */
    function deactivateToken(address backingToken) external onlyOwner {
        require(listedTokens[backingToken].backingToken != address(0), "Token not listed");
        listedTokens[backingToken].active = false;
        emit TokenDeactivated(backingToken);
    }
    
    /**
     * @notice Reactivate a token (admin only)
     */
    function reactivateToken(address backingToken) external onlyOwner {
        require(listedTokens[backingToken].backingToken != address(0), "Token not listed");
        listedTokens[backingToken].active = true;
        emit TokenReactivated(backingToken);
    }
    
    
    /**
     * @notice Update fee collector address (admin only)
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Fee collector cannot be zero address");
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }
    
    /**
     * @notice Update platform fee share (admin only)
     */
    function setPlatformFeeShare(uint256 newShare) external onlyOwner {
        require(newShare <= 2000, "Platform fee cannot exceed 20%"); // Max 20%
        platformFeeShare = newShare;
        emit PlatformFeeShareUpdated(newShare);
    }
    
    /**
     * @notice Update fee address for a specific leverage contract (admin only)
     */
    function setLeverageContractFeeAddress(address backingToken, address newFeeAddress) external onlyOwner {
        require(listedTokens[backingToken].active, "Token not active");
        require(newFeeAddress != address(0), "Fee address cannot be zero");
        
        LeverageToken leverageContract = LeverageToken(listedTokens[backingToken].leverageContract);
        leverageContract.setFeeAddress(newFeeAddress);
        
        emit LeverageContractFeeAddressUpdated(backingToken, newFeeAddress);
    }
    
    /**
     * @notice Update fee addresses for all leverage contracts (admin only)
     */
    function setAllLeverageContractsFeeAddress(address newFeeAddress) external onlyOwner {
        require(newFeeAddress != address(0), "Fee address cannot be zero");
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (listedTokens[tokenList[i]].active) {
                LeverageToken leverageContract = LeverageToken(listedTokens[tokenList[i]].leverageContract);
                leverageContract.setFeeAddress(newFeeAddress);
            }
        }
        
        emit AllLeverageContractsFeeAddressUpdated(newFeeAddress);
    }

    /**
     * @notice Update fee addresses for leverage contracts in batches (gas efficient)
     */
    function setBatchLeverageContractsFeeAddress(
        uint256 startIndex, 
        uint256 endIndex, 
        address newFeeAddress
    ) external onlyOwner {
        require(newFeeAddress != address(0), "Fee address cannot be zero");
        require(startIndex < tokenList.length, "Start index out of bounds");
        require(endIndex <= tokenList.length, "End index out of bounds");
        require(startIndex < endIndex, "Invalid range");
        
        uint256 updatedCount = 0;
        for (uint256 i = startIndex; i < endIndex; i++) {
            if (listedTokens[tokenList[i]].active) {
                LeverageToken leverageContract = LeverageToken(listedTokens[tokenList[i]].leverageContract);
                leverageContract.setFeeAddress(newFeeAddress);
                updatedCount++;
            }
        }
        
        emit BatchLeverageContractsFeeAddressUpdated(startIndex, endIndex, updatedCount, newFeeAddress);
    }

    /**
     * @notice Get token addresses in a range (for batching verification)
     */
    function getTokenRange(uint256 startIndex, uint256 endIndex) 
        external 
        view 
        returns (address[] memory tokens, bool[] memory activeStatus) 
    {
        require(startIndex < tokenList.length, "Start index out of bounds");
        require(endIndex <= tokenList.length, "End index out of bounds");
        require(startIndex < endIndex, "Invalid range");
        
        uint256 length = endIndex - startIndex;
        tokens = new address[](length);
        activeStatus = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            address token = tokenList[startIndex + i];
            tokens[i] = token;
            activeStatus[i] = listedTokens[token].active;
        }
    }

    /**
     * @notice Add an authorized lister (admin only)
     */
    function addLister(address lister) external onlyOwner {
        require(lister != address(0), "Lister cannot be zero address");
        require(!authorizedListers[lister], "Already authorized lister");
        
        authorizedListers[lister] = true;
        listerList.push(lister);
        
        emit ListerAdded(lister);
    }
    
    /**
     * @notice Remove an authorized lister (admin only)
     */
    function removeLister(address lister) external onlyOwner {
        require(authorizedListers[lister], "Not an authorized lister");
        require(lister != owner(), "Cannot remove owner from listers");
        
        authorizedListers[lister] = false;
        
        // Remove from listerList array
        for (uint256 i = 0; i < listerList.length; i++) {
            if (listerList[i] == lister) {
                listerList[i] = listerList[listerList.length - 1];
                listerList.pop();
                break;
            }
        }
        
        emit ListerRemoved(lister);
    }
    
    /**
     * @notice Check if address is authorized lister
     */
    function isAuthorizedLister(address lister) external view returns (bool) {
        return authorizedListers[lister];
    }
    
    /**
     * @notice Get all authorized listers
     */
    function getAllListers() external view returns (address[] memory) {
        address[] memory activeListers = new address[](listerList.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < listerList.length; i++) {
            if (authorizedListers[listerList[i]]) {
                activeListers[count] = listerList[i];
                count++;
            }
        }
        
        // Resize array to actual count
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeListers[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get number of authorized listers
     */
    function getListerCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < listerList.length; i++) {
            if (authorizedListers[listerList[i]]) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // View functions for analytics
    
    /**
     * @notice Get platform statistics
     */
    function getPlatformStats() external view returns (
        uint256 totalTokens,
        uint256 activeTokens,
        uint256 totalVolume,
        uint256 totalFeesCollected
    ) {
        totalTokens = tokenList.length;
        
        uint256 activeCount = 0;
        uint256 volume = 0;
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (listedTokens[tokenList[i]].active) {
                activeCount++;
                // Could add volume tracking here if needed
            }
        }
        
        activeTokens = activeCount;
        totalVolume = volume; // Placeholder
        totalFeesCollected = address(this).balance; // Placeholder
    }
}