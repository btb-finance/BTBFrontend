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

    // BTBSwap events
    event SwapBTBForNFTEvent(address indexed user, uint256 btbAmount, uint256[] nftIds);
    event SwapNFTForBTBEvent(address indexed user, uint256[] nftIds, uint256 btbAmount);
    event SwapStatusChangedEvent(bool paused);
    event SwapFeePercentageUpdatedEvent(uint256 newFeePercentage);
    event AdminFeeShareUpdatedEvent(uint256 newAdminFeeShare);
    event FeesCollectedEvent(address indexed recipient, uint256 amount);
    event NFTDispensedForRedemption(address indexed recipient, uint256 tokenId);

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
        return btbBalance / (totalNFTSupply - nftsInContract);
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

        if (btbToken.balanceOf(user) < totalAmount) revert InsufficientTokenBalance();
        if (btbToken.allowance(user, address(this)) < totalAmount) revert InsufficientTokenAllowance();

        bool success = btbToken.transferFrom(user, address(this), totalAmount);
        if (!success) revert TransferFailed();

        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            success = btbToken.transfer(feeReceiver, adminFeeAmount);
            if (success) {
                emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
            }
            // Not reverting on failed fee transfer, as main transfer already happened. Log or handle.
        }

        nftIds = new uint256[](amount);
        uint256 count = 0;
        // This simplistic NFT finding loop is gas intensive and not suitable for mainnet.
        // It should be replaced with a proper inventory management system.
        // For now, keeping original logic's spirit for finding NFTs owned by this contract.
        for (uint256 i = 1; count < amount && i <= 100000; i++) { // Max 100k IDs to check
            try bearNFT.ownerOf(i) returns (address owner) {
                if (owner == address(this)) {
                    nftIds[count] = i;
                    count++;
                }
            } catch { /* ignore, token does not exist or other issue */ }
        }
        if (count < amount) revert InsufficientNFTBalance(); // Should not happen if initial check passed.

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

        for (uint256 i = 0; i < length; i++) {
            if (bearNFT.ownerOf(tokenIds[i]) != user) revert InsufficientNFTBalance(); // User must own the NFTs
            // Also check approval for all NFTs
            if (!bearNFT.isApprovedForAll(user, address(this)) && bearNFT.getApproved(tokenIds[i]) != address(this)) {
                 revert InsufficientNFTBalance(); // Using this error, should be more specific like "NFTNotApproved"
            }
        }
        
        uint256 swapRate = getSwapRate();
        if (swapRate == 0 || swapRate == type(uint256).max) revert InvalidAmount(); // Or specific error for bad rate
        uint256 baseAmount = swapRate * length;
        uint256 feeAmount = (baseAmount * swapFeePercentage) / 10000;
        btbAmountToUser = baseAmount - feeAmount;
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;

        if (btbToken.balanceOf(address(this)) < btbAmountToUser) revert InsufficientTokenBalance();

        for (uint256 i = 0; i < length; i++) {
            bearNFT.safeTransferFrom(user, address(this), tokenIds[i]);
        }

        bool success = btbToken.transfer(user, btbAmountToUser);
        if (!success) revert TransferFailed();

        if (adminFeeAmount > 0 && feeReceiver != address(0)) {
            // Admin fee comes from the contract's BTB holdings after receiving user's fee portion or from initial liquidity.
            // This assumes the contract has enough BTB to cover this admin fee.
            if (btbToken.balanceOf(address(this)) >= adminFeeAmount) {
                success = btbToken.transfer(feeReceiver, adminFeeAmount);
                if (success) {
                    emit FeesCollectedEvent(feeReceiver, adminFeeAmount);
                }
            }
            // Not reverting on failed fee transfer. Log or handle.
        }
        emit SwapNFTForBTBEvent(user, tokenIds, btbAmountToUser);
        return btbAmountToUser;
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
} 