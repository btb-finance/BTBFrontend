// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract BTBSwapLogic is Ownable, ReentrancyGuard, IERC721Receiver {
    IERC721 public bearNFT;
    IERC20 public btbToken;
    address public feeReceiver; // For admin fees from swaps

    // Custom errors
    error SwapPaused();
    error InvalidAmount();
    error InsufficientNFTBalance();
    error InsufficientTokenBalance();
    error InsufficientTokenAllowance();
    error TransferFailed();
    error InvalidFeePercentage();
    error NoNFTsAvailableForRedemption();
    error NotBearNFT(); // For onERC721Received check

    // BTBSwap Variables
    uint256 public swapFeePercentage = 100; // Default 1% (in basis points)
    uint256 public adminFeeShare = 5000;    // Default 50% of the fee (in basis points)
    bool public swapPausedState;             // Renamed from swapPaused to avoid conflict if main contract has one
    
    // Premium for buying NFTs - additional BTB tokens required per NFT
    uint256 public buyPremium = 0;          // Default 0 = no premium

    // BTBSwap events
    event SwapBTBForNFTEvent(address indexed user, uint256 btbAmount, uint256[] nftIds);
    event SwapNFTForBTBEvent(address indexed user, uint256[] nftIds, uint256 btbAmount);
    event SwapStatusChangedEvent(bool paused);
    event SwapFeePercentageUpdatedEvent(uint256 newFeePercentage);
    event AdminFeeShareUpdatedEvent(uint256 newAdminFeeShare);
    event FeesCollectedEvent(address indexed recipient, uint256 amount);
    event NFTDispensedForRedemption(address indexed recipient, uint256 tokenId);
    event BuyPremiumUpdatedEvent(uint256 newPremium);

    constructor(address initialOwner, address _bearNFTAddress, address _btbTokenAddress, address _feeReceiverAddress) Ownable(initialOwner) {
        bearNFT = IERC721(_bearNFTAddress);
        btbToken = IERC20(_btbTokenAddress);
        feeReceiver = _feeReceiverAddress;
    }

    function setAddresses(address _bearNFTAddress, address _btbTokenAddress, address _feeReceiverAddress) external onlyOwner {
        bearNFT = IERC721(_bearNFTAddress);
        btbToken = IERC20(_btbTokenAddress);
        feeReceiver = _feeReceiverAddress;
    }

    function getSwapRate() public view returns (uint256) {
        uint256 btbBalance = btbToken.balanceOf(address(this)); // This contract must hold BTB for swaps
        uint256 totalNFTSupply = 100_000; // Assuming 100k total supply of BEAR NFTs
        uint256 nftsInContract = bearNFT.balanceOf(address(this)); // This contract must hold NFTs for swaps

        if (btbBalance == 0) {
            return 0;
        }
        if (totalNFTSupply == nftsInContract && totalNFTSupply > 0) { // Avoid division by zero if all NFTs are here
             // If all NFTs are in the contract, and there's BTB, this implies infinite price for selling NFTs to contract.
             // For buying NFTs from contract, a different logic or fixed price might be needed.
             // For now, let's return a very high number or handle as error in swap.
             // This part of logic might need refinement based on desired AMM behavior.
             // Simplified: if contract holds all NFTs, it can't buy more, only sell.
             // If it holds BTB and all NFTs, price to buy an NFT from contract should be defined.
             // Let's assume this means a rate for USER selling NFT to contract.
             // If contract has all NFTs, rate for USER to sell NFT is effectively 0 as contract won't buy.
             // If user wants to buy NFT from contract, and contract has all, this is the scenario.
            return type(uint256).max; // Or a predefined ceiling price.
        }
        if (totalNFTSupply <= nftsInContract) { // Prevents division by zero or negative
            return type(uint256).max; // Or handle appropriately
        }
        uint256 baseRate = btbBalance / (totalNFTSupply - nftsInContract);
        return baseRate + buyPremium; // Add premium for buying NFTs
    }

    function swapBTBForNFT(address user, uint256 amount) external nonReentrant returns (uint256[] memory nftIds) {
        if (swapPausedState) revert SwapPaused();
        if (amount == 0) revert InvalidAmount();
        if (bearNFT.balanceOf(address(this)) < amount) revert InsufficientNFTBalance();

        uint256 swapRate = getSwapRate();
        if (swapRate == 0 || swapRate == type(uint256).max) revert InvalidAmount(); // Or specific error for bad rate
        uint256 baseAmount = swapRate * amount;
        uint256 feeAmount = (baseAmount * swapFeePercentage) / 10000;
        uint256 totalAmount = baseAmount + feeAmount;
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;

        // Validate user has enough tokens and allowance
        if (btbToken.balanceOf(user) < totalAmount) revert InsufficientTokenBalance();
        if (btbToken.allowance(user, address(this)) < totalAmount) revert InsufficientTokenAllowance();

        // Execute token transfer first - security best practice
        bool success = btbToken.transferFrom(user, address(this), totalAmount);
        if (!success) revert TransferFailed();

        // Transfer admin fee if applicable
        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            success = btbToken.transfer(feeReceiver, adminFeeAmount);
            if (success) {
                emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
            }
            // Not reverting on failed fee transfer, as main transfer already happened
        }

        // Find available NFT IDs using more efficient tracking
        nftIds = findAvailableNFTs(amount);
        
        // Transfer all NFTs to user
        for (uint256 i = 0; i < amount; i++) {
            bearNFT.safeTransferFrom(address(this), user, nftIds[i]);
        }
        
        emit SwapBTBForNFTEvent(user, totalAmount, nftIds);
        return nftIds;
    }

    function swapNFTForBTB(address user, uint256[] calldata tokenIds) external nonReentrant returns (uint256 btbAmountToUser) {
        if (swapPausedState) revert SwapPaused();
        uint256 length = tokenIds.length;
        if (length == 0) revert InvalidAmount();

        // Validate user has the NFTs and proper approvals upfront
        for (uint256 i = 0; i < length; i++) {
            if (bearNFT.ownerOf(tokenIds[i]) != user) revert InsufficientNFTBalance();
            if (!bearNFT.isApprovedForAll(user, address(this)) && bearNFT.getApproved(tokenIds[i]) != address(this)) {
                revert InsufficientNFTBalance(); // Should use a more specific error like NFTNotApproved
            }
        }
        
        // Calculate payment amount
        uint256 swapRate = getSwapRate();
        if (swapRate == 0 || swapRate == type(uint256).max) revert InvalidAmount();
        uint256 baseAmount = swapRate * length;
        uint256 feeAmount = (baseAmount * swapFeePercentage) / 10000;
        btbAmountToUser = baseAmount - feeAmount;
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;

        // Validate contract has enough BTB
        if (btbToken.balanceOf(address(this)) < btbAmountToUser) revert InsufficientTokenBalance();

        // First collect all NFTs
        for (uint256 i = 0; i < length; i++) {
            bearNFT.safeTransferFrom(user, address(this), tokenIds[i]);
        }

        // Then send BTB to user
        bool success = btbToken.transfer(user, btbAmountToUser);
        if (!success) revert TransferFailed();

        // Handle admin fee
        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            if (btbToken.balanceOf(address(this)) >= adminFeeAmount) {
                success = btbToken.transfer(feeReceiver, adminFeeAmount);
                if (success) {
                    emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
                }
            }
        }
        
        emit SwapNFTForBTBEvent(user, tokenIds, btbAmountToUser);
        return btbAmountToUser;
    }
    
    /**
     * @dev Find the specified number of NFTs that the contract owns
     * @param count Number of NFTs to find
     * @return nftIds Array of found NFT IDs
     */
    function findAvailableNFTs(uint256 count) private view returns (uint256[] memory nftIds) {
        nftIds = new uint256[](count);
        uint256 found = 0;
        
        // Store the last checked token ID to optimize future searches
        uint256 startTokenId = 1; // Start from ID 1
        uint256 searchLimit = 10000; // Maximum range to search to prevent gas issues
        
        // Find 'count' NFTs owned by this contract
        for (uint256 i = startTokenId; found < count && i < startTokenId + searchLimit; i++) {
            try bearNFT.ownerOf(i) returns (address owner) {
                if (owner == address(this)) {
                    nftIds[found] = i;
                    found++;
                }
            } catch {
                continue;
            }
        }
        
        // Make sure we found enough NFTs
        if (found < count) revert InsufficientNFTBalance();
        
        return nftIds;
    }
    
    /**
     * @dev Get available NFT IDs for informational purposes (e.g., for frontend)
     * @param limit Maximum number of NFT IDs to return
     * @param startId Token ID to start searching from (for pagination)
     * @return nftIds Array of available NFT IDs
     * @return totalAvailable Total number of NFTs the contract owns
     * @return nextStartId The next token ID to start from in subsequent calls
     */
    function getAvailableNFTs(
        uint256 limit,
        uint256 startId
    ) external view returns (
        uint256[] memory nftIds,
        uint256 totalAvailable,
        uint256 nextStartId
    ) {
        // Get total NFTs owned by this contract
        totalAvailable = bearNFT.balanceOf(address(this));
        
        // Cap limit for gas efficiency
        if (limit == 0) {
            limit = 50; // Default to 50 NFTs
        } else if (limit > 100) {
            limit = 100; // Cap at 100 NFTs max to prevent gas issues
        }
        
        // Start from at least token ID 1
        if (startId == 0) {
            startId = 1;
        }
        
        // Find the specified number of NFTs
        nftIds = new uint256[](limit);
        uint256 found = 0;
        uint256 searchLimit = 10000; // Limit the search range to prevent gas issues
        nextStartId = startId; // Initialize to current start
        
        for (uint256 i = startId; found < limit && i < startId + searchLimit; i++) {
            try bearNFT.ownerOf(i) returns (address owner) {
                if (owner == address(this)) {
                    nftIds[found] = i;
                    found++;
                }
            } catch {
                continue;
            }
            nextStartId = i + 1; // Update the next start ID
        }
        
        // If we didn't find enough NFTs to fill the array, resize it
        if (found < limit) {
            assembly {
                mstore(nftIds, found) // Resize the array to actual found length
            }
        }
        
        return (nftIds, totalAvailable, nextStartId);
    }

    // Admin functions
    function setSwapPaused(bool paused) external onlyOwner {
        swapPausedState = paused;
        emit SwapStatusChangedEvent(paused);
    }

    function setSwapFeePercentage(uint256 newFeePercentage) external onlyOwner {
        if (newFeePercentage > 10000) revert InvalidFeePercentage(); // Max 100%
        swapFeePercentage = newFeePercentage;
        emit SwapFeePercentageUpdatedEvent(newFeePercentage);
    }

    function setAdminFeeShare(uint256 newAdminFeeShare) external onlyOwner {
        if (newAdminFeeShare > 10000) revert InvalidFeePercentage(); // Max 100% of the fee
        adminFeeShare = newAdminFeeShare;
        emit AdminFeeShareUpdatedEvent(newAdminFeeShare);
    }

    function setBuyPremium(uint256 newPremium) external onlyOwner {
        buyPremium = newPremium;
        emit BuyPremiumUpdatedEvent(newPremium);
    }

    // Function for the owner (BearHunterEcosystem) to withdraw collected BTB (not part of admin fee share)
    function withdrawBTBCollected(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        uint256 balance = btbToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient contract balance");
        bool success = btbToken.transfer(to, amount);
        if(!success) revert TransferFailed();
    }
    
    // Function for the owner (BearHunterEcosystem) to withdraw specific NFTs if needed
    function withdrawBearNFTs(address to, uint256[] calldata tokenIds) external onlyOwner {
        require(to != address(0), "Zero address");
        for(uint256 i=0; i < tokenIds.length; i++){
            require(bearNFT.ownerOf(tokenIds[i]) == address(this), "Not owner of NFT");
            bearNFT.safeTransferFrom(address(this), to, tokenIds[i]);
        }
    }

    // Function for BearHunterEcosystem (owner) to retrieve an NFT for user redemption
    function retrieveAnyNFTForRedemption(address recipient) external onlyOwner nonReentrant returns (uint256 tokenId) {
        if (recipient == address(0)) revert InvalidAmount(); 
        
        uint256 balance = bearNFT.balanceOf(address(this));
        if (balance == 0) revert NoNFTsAvailableForRedemption();

        for (uint256 i = 1; i <= 100000; i++) { 
            try bearNFT.ownerOf(i) returns (address owner) {
                if (owner == address(this)) {
                    tokenId = i;
                    bearNFT.safeTransferFrom(address(this), recipient, tokenId);
                    emit NFTDispensedForRedemption(recipient, tokenId);
                    return tokenId;
                }
            } catch {
                continue;
            }
        }
        revert NoNFTsAvailableForRedemption(); 
    }
    
    /**
     * @dev Retrieve multiple NFTs for redemption in a single transaction
     * @param recipient Address to receive the NFTs
     * @param count Number of NFTs to redeem
     * @return tokenIds Array of redeemed NFT IDs
     */
    function retrieveMultipleNFTsForRedemption(
        address recipient,
        uint256 count
    ) external onlyOwner nonReentrant returns (uint256[] memory tokenIds) {
        if (recipient == address(0)) revert InvalidAmount();
        if (count == 0) revert InvalidAmount();
        
        uint256 balance = bearNFT.balanceOf(address(this));
        if (balance < count) revert NoNFTsAvailableForRedemption();
        
        tokenIds = new uint256[](count);
        uint256 found = 0;
        
        // Find 'count' NFTs owned by this contract
        for (uint256 i = 1; found < count && i <= 100000; i++) {
            try bearNFT.ownerOf(i) returns (address owner) {
                if (owner == address(this)) {
                    tokenIds[found] = i;
                    found++;
                }
            } catch {
                continue;
            }
        }
        
        // Make sure we found enough NFTs
        if (found < count) revert NoNFTsAvailableForRedemption();
        
        // Transfer all NFTs in a single loop
        for (uint256 i = 0; i < count; i++) {
            bearNFT.safeTransferFrom(address(this), recipient, tokenIds[i]);
            emit NFTDispensedForRedemption(recipient, tokenIds[i]);
        }
        
        return tokenIds;
    }

    /**
     * @dev See {IERC721Receiver-onERC721Received}.
     * This contract should only accept BearNFTs it is configured to handle.
     */
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    ) external view override returns (bytes4) {
        // Check if the received NFT is the configured bearNFT contract
        // msg.sender in this context is the NFT contract calling this hook
        if (msg.sender != address(bearNFT)) {
            revert NotBearNFT(); 
        }
        // Further checks can be added here if needed, e.g., based on `data` or `operator`
        // For now, just accepting the configured bearNFT is sufficient for its role as a liquidity pool
        return this.onERC721Received.selector;
    }

    /**
     * @dev Swap BTB tokens for a specific set of NFTs
     * @param user Address of the user performing the swap
     * @param specificTokenIds Array of specific token IDs that the user wants to acquire
     * @return totalCost Total amount of BTB tokens spent
     */
    function swapBTBForSpecificNFTs(
        address user,
        uint256[] calldata specificTokenIds
    ) external nonReentrant returns (uint256 totalCost) {
        if (swapPausedState) revert SwapPaused();
        uint256 length = specificTokenIds.length;
        if (length == 0) revert InvalidAmount();
        
        // Limit batch size to prevent gas issues
        if (length > 100) revert InvalidAmount();
        
        // Validate contract owns all specified NFTs
        for (uint256 i = 0; i < length; i++) {
            try bearNFT.ownerOf(specificTokenIds[i]) returns (address owner) {
                if (owner != address(this)) {
                    revert InsufficientNFTBalance();
                }
            } catch {
                revert InsufficientNFTBalance();
            }
        }
        
        // Calculate cost
        uint256 swapRate = getSwapRate();
        if (swapRate == 0 || swapRate == type(uint256).max) revert InvalidAmount();
        uint256 baseAmount = swapRate * length;
        uint256 feeAmount = (baseAmount * swapFeePercentage) / 10000;
        totalCost = baseAmount + feeAmount;
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;
        
        // Validate user has enough tokens and allowance
        if (btbToken.balanceOf(user) < totalCost) revert InsufficientTokenBalance();
        if (btbToken.allowance(user, address(this)) < totalCost) revert InsufficientTokenAllowance();
        
        // Execute token transfer first - security best practice
        bool success = btbToken.transferFrom(user, address(this), totalCost);
        if (!success) revert TransferFailed();
        
        // Transfer admin fee if applicable
        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            success = btbToken.transfer(feeReceiver, adminFeeAmount);
            if (success) {
                emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
            }
        }
        
        // Transfer all NFTs to user
        for (uint256 i = 0; i < length; i++) {
            bearNFT.safeTransferFrom(address(this), user, specificTokenIds[i]);
        }
        
        emit SwapBTBForNFTEvent(user, totalCost, specificTokenIds);
        return totalCost;
    }

    /**
     * @dev Efficiently swap BTB for multiple NFTs with fewer gas costs
     * @param user Address of the user performing the swap
     * @param amount Number of NFTs to acquire
     * @return nftIds Array of acquired NFT IDs
     */
    function batchSwapBTBForNFT(
        address user,
        uint256 amount
    ) external nonReentrant returns (uint256[] memory nftIds) {
        // This is a more gas-efficient version of swapBTBForNFT for large batches
        if (swapPausedState) revert SwapPaused();
        if (amount == 0) revert InvalidAmount();
        
        // Cap amount to prevent gas issues
        if (amount > 100) {
            amount = 100;
        }
        
        if (bearNFT.balanceOf(address(this)) < amount) revert InsufficientNFTBalance();
        
        // Calculate cost in one go
        uint256 swapRate = getSwapRate();
        if (swapRate == 0 || swapRate == type(uint256).max) revert InvalidAmount();
        uint256 baseAmount = swapRate * amount;
        uint256 feeAmount = (baseAmount * swapFeePercentage) / 10000;
        uint256 totalAmount = baseAmount + feeAmount;
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;
        
        // Check user balances and transfer tokens
        if (btbToken.balanceOf(user) < totalAmount) revert InsufficientTokenBalance();
        if (btbToken.allowance(user, address(this)) < totalAmount) revert InsufficientTokenAllowance();
        
        bool success = btbToken.transferFrom(user, address(this), totalAmount);
        if (!success) revert TransferFailed();
        
        // Process admin fee
        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            btbToken.transfer(feeReceiver, adminFeeAmount);
            emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
        }
        
        // Find available NFTs with limited search range
        nftIds = findAvailableNFTs(amount);
        
        // Transfer NFTs to user in a batch loop
        for (uint256 i = 0; i < amount; i++) {
            bearNFT.safeTransferFrom(address(this), user, nftIds[i]);
        }
        
        emit SwapBTBForNFTEvent(user, totalAmount, nftIds);
        return nftIds;
    }

    /**
     * @dev Batch swap multiple NFTs for BTB tokens with optimized gas usage
     * @param user Address of the user performing the swap
     * @param minBTBAmount Minimum amount of BTB expected to receive (slippage protection)
     * @param maxNFTs Maximum number of NFTs to sell (limits gas cost)
     * @param startTokenId Token ID to start searching from
     * @return tokenIds Array of NFT IDs sold
     * @return btbAmountToUser Total BTB amount received
     * @return nextTokenId Next token ID to continue from in subsequent calls
     */
    function batchSwapNFTForBTB(
        address user,
        uint256 minBTBAmount,
        uint256 maxNFTs,
        uint256 startTokenId
    ) external nonReentrant returns (
        uint256[] memory tokenIds,
        uint256 btbAmountToUser,
        uint256 nextTokenId
    ) {
        if (swapPausedState) revert SwapPaused();
        if (maxNFTs == 0) revert InvalidAmount();
        
        // Cap maxNFTs to prevent gas issues
        if (maxNFTs > 100) {
            maxNFTs = 100;
        }
        
        // Count how many NFTs the user owns (up to maxNFTs)
        uint256 userNFTBalance = bearNFT.balanceOf(user);
        uint256 nftsToSwap = userNFTBalance < maxNFTs ? userNFTBalance : maxNFTs;
        if (nftsToSwap == 0) revert InsufficientNFTBalance();
        
        // Make sure the contract can see the user's NFTs (approval check)
        // This assumes the user has approved all their NFTs to this contract
        if (!bearNFT.isApprovedForAll(user, address(this))) {
            revert InsufficientNFTBalance(); // Better error would be "NFTNotApproved"
        }
        
        // Calculate swap amounts
        uint256 swapRate = getSwapRate();
        if (swapRate == 0 || swapRate == type(uint256).max) revert InvalidAmount();
        uint256 baseAmount = swapRate * nftsToSwap;
        uint256 feeAmount = (baseAmount * swapFeePercentage) / 10000;
        btbAmountToUser = baseAmount - feeAmount;
        
        // Enforce minimum received amount (slippage protection)
        if (btbAmountToUser < minBTBAmount) revert InvalidAmount();
        
        // Ensure the contract has enough BTB tokens
        if (btbToken.balanceOf(address(this)) < btbAmountToUser) revert InsufficientTokenBalance();
        
        // Start from at least token ID 1
        if (startTokenId == 0) {
            startTokenId = 1;
        }
        
        // Find NFTs owned by the user (up to nftsToSwap)
        tokenIds = new uint256[](nftsToSwap);
        uint256 found = 0;
        uint256 searchLimit = 10000; // Limit the search range to prevent gas issues
        nextTokenId = startTokenId; // Initialize to current start
        
        // Find NFTs owned by the user
        for (uint256 i = startTokenId; found < nftsToSwap && i < startTokenId + searchLimit; i++) {
            try bearNFT.ownerOf(i) returns (address owner) {
                if (owner == user) {
                    tokenIds[found] = i;
                    found++;
                }
            } catch {
                continue;
            }
            nextTokenId = i + 1; // Update next token ID for pagination
        }
        
        // If we didn't find enough NFTs to fill the array, resize it
        if (found < nftsToSwap) {
            // Resize the array to actual found length
            assembly {
                mstore(tokenIds, found)
            }
        }
        
        // Transfer all NFTs to this contract
        for (uint256 i = 0; i < found; i++) {
            bearNFT.safeTransferFrom(user, address(this), tokenIds[i]);
        }
        
        // Recalculate based on actual NFTs transferred
        if (found < nftsToSwap) {
            // Recalculate amounts based on actual tokens transferred
            baseAmount = swapRate * found;
            feeAmount = (baseAmount * swapFeePercentage) / 10000;
            btbAmountToUser = baseAmount - feeAmount;
        }
        
        // Ensure we still meet minimum amount
        if (btbAmountToUser < minBTBAmount) revert InvalidAmount();
        
        // Transfer BTB tokens to the user
        bool success = btbToken.transfer(user, btbAmountToUser);
        if (!success) revert TransferFailed();
        
        // Process admin fee
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;
        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            if (btbToken.balanceOf(address(this)) >= adminFeeAmount) {
                success = btbToken.transfer(feeReceiver, adminFeeAmount);
                if (success) {
                    emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
                }
            }
        }
        
        emit SwapNFTForBTBEvent(user, tokenIds, btbAmountToUser);
        return (tokenIds, btbAmountToUser, nextTokenId);
    }
} 