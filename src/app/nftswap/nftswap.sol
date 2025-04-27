// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title BTBSwap
 * @dev Contract to swap between BTB tokens and BEAR NFTs
 */
contract BTBSwap is Ownable, ReentrancyGuard {
    // Custom errors for gas optimization
    error InvalidToken();
    error InvalidNFT();
    error InsufficientBTBBalance();
    error InsufficientNFTBalance();
    error InsufficientBTBAllowance();
    error TransferFailed();
    error ZeroAddressNotAllowed();
    error InvalidAmount();
    error SwapPaused();
    error InvalidFeePercentage();
    error ETHTransferFailed();

    // BTB token contract
    IERC20 public btbToken;
    
    // BEAR NFT contract
    ERC721Enumerable public bearNFT;
    
    // Swap status
    bool public swapPaused;
    
    // Fee percentage (in basis points, 100 = 1%)
    uint256 public feePercentage = 100; // Default 1%
    
    // Percentage of fees that go to admin (in basis points of the fee, 5000 = 50%)
    uint256 public adminFeeShare = 5000; // Default 50%
    
    // Admin fee recipient address
    address public feeRecipient;
    
    // Events
    event SwapBTBForNFT(address indexed user, uint256 btbAmount, uint256[] nftIds);
    event SwapNFTForBTB(address indexed user, uint256[] nftIds, uint256 btbAmount);
    event SwapStatusChanged(bool paused);
    event FeePercentageUpdated(uint256 newFeePercentage);
    event AdminFeeShareUpdated(uint256 newAdminFeeShare);
    event FeeRecipientUpdated(address newFeeRecipient);
    event FeesCollected(address indexed recipient, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event ETHWithdrawn(address indexed recipient, uint256 amount);
    
    /**
     * @dev Constructor to set token addresses
     */
    constructor(address _btbToken, address _bearNFT, address initialOwner) Ownable(initialOwner) {
        if (_btbToken == address(0) || _bearNFT == address(0) || initialOwner == address(0)) 
            revert ZeroAddressNotAllowed();
        
        btbToken = IERC20(_btbToken);
        bearNFT = ERC721Enumerable(_bearNFT);
        swapPaused = false;
        feeRecipient = initialOwner;
    }
    
    /**
     * @dev Calculate the swap rate based on formula:
     * BTB balance in contract / (NFT total supply - NFTs in contract)
     */
    function getSwapRate() public view returns (uint256) {
        uint256 btbBalance = btbToken.balanceOf(address(this));
        uint256 totalNFTSupply = 100_000;
        uint256 nftsInContract = bearNFT.balanceOf(address(this));
        
        // If there are no BTB tokens, return 0
        if (btbBalance == 0) {
            return 0;
        }
        
        // If there are no NFTs outside the contract, use a default rate
        // based on total supply to avoid division by zero
        if (totalNFTSupply == nftsInContract) {
            // If all NFTs are in the contract, use 10 BTB per NFT as default rate
            return 1000 * 10**18; // 10 BTB in wei
        }
        
        // Calculate rate: BTB per NFT
        return btbBalance / (totalNFTSupply - nftsInContract);
    }
    
    /**
     * @dev Swap BTB tokens for BEAR NFTs
     * @param amount Number of NFTs to receive
     */
    function swapBTBForNFT(uint256 amount) external nonReentrant returns (uint256[] memory) {
        if (swapPaused) revert SwapPaused();
        if (amount == 0) revert InvalidAmount();
        
        // Check if contract has enough NFTs
        uint256 contractNFTBalance = bearNFT.balanceOf(address(this));
        if (contractNFTBalance < amount) revert InsufficientNFTBalance();
        
        // Calculate BTB amount needed
        uint256 swapRate = getSwapRate();
        if (swapRate == 0) revert InvalidAmount();
        uint256 baseAmount = swapRate * amount;
        
        // Apply fee (buyer pays more)
        uint256 feeAmount = (baseAmount * feePercentage) / 10000;
        uint256 totalAmount = baseAmount + feeAmount;
        
        // Calculate admin's share of the fee
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;
        
        // Check user's BTB balance and allowance
        if (btbToken.balanceOf(msg.sender) < totalAmount) revert InsufficientBTBBalance();
        if (btbToken.allowance(msg.sender, address(this)) < totalAmount) revert InsufficientBTBAllowance();
        
        // Transfer BTB tokens from user to contract
        bool success = btbToken.transferFrom(msg.sender, address(this), totalAmount);
        if (!success) revert TransferFailed();
        
        // Transfer admin fee if applicable
        if (adminFeeAmount > 0 && feeRecipient != address(0)) {
            success = btbToken.transfer(feeRecipient, adminFeeAmount);
            if (success) {
                emit FeesCollected(feeRecipient, adminFeeAmount);
            }
        }
        
        // Store NFT IDs first to avoid reentrancy during transfers
        uint256[] memory nftIds = new uint256[](amount);
        uint256 lastIndex = bearNFT.balanceOf(address(this)) - 1;
        
        // Use reverse selection for gas optimization
        for (uint256 i = 0; i < amount; i++) {
            nftIds[i] = bearNFT.tokenOfOwnerByIndex(address(this), lastIndex - i);
        }
        
        // Transfer NFTs after all state changes
        for (uint256 i = 0; i < amount; i++) {
            bearNFT.safeTransferFrom(address(this), msg.sender, nftIds[i]);
        }
        
        emit SwapBTBForNFT(msg.sender, totalAmount, nftIds);
        return nftIds;
    }
    
    /**
     * @dev Swap BEAR NFTs for BTB tokens by providing specific token IDs
     * @param tokenIds Array of NFT token IDs to swap
     */
    function swapNFTForBTB(uint256[] calldata tokenIds) external nonReentrant returns (uint256) {
        if (swapPaused) revert SwapPaused();
        uint256 length = tokenIds.length;
        if (length == 0) revert InvalidAmount();
        
        // Calculate BTB amount to give
        uint256 swapRate = getSwapRate();
        if (swapRate == 0) revert InvalidAmount();
        uint256 baseAmount = swapRate * length;
        
        // Apply fee (seller receives less)
        uint256 feeAmount = (baseAmount * feePercentage) / 10000;
        uint256 amountToUser = baseAmount - feeAmount;
        
        // Calculate admin's share of the fee
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;
        
        // Check contract's BTB balance
        if (btbToken.balanceOf(address(this)) < amountToUser + adminFeeAmount) revert InsufficientBTBBalance();
        
        // Verify user owns all NFTs first
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            if (bearNFT.ownerOf(tokenId) != msg.sender) revert InsufficientNFTBalance();
        }
        
        // Transfer NFTs from user to contract
        for (uint256 i = 0; i < length; i++) {
            bearNFT.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
        }
        
        // Transfer BTB tokens to user
        bool success = btbToken.transfer(msg.sender, amountToUser);
        if (!success) revert TransferFailed();
        
        // Transfer admin fee if applicable
        if (adminFeeAmount > 0 && feeRecipient != address(0)) {
            success = btbToken.transfer(feeRecipient, adminFeeAmount);
            if (success) {
                emit FeesCollected(feeRecipient, adminFeeAmount);
            }
        }
        
        emit SwapNFTForBTB(msg.sender, tokenIds, amountToUser);
        return amountToUser;
    }
    
    /**
     * @dev Swap a specific number of BEAR NFTs for BTB tokens (automatically selects NFTs)
     * @param amount Number of NFTs to sell
     */
    function swapNFTsForBTB(uint256 amount) external nonReentrant returns (uint256) {
        if (swapPaused) revert SwapPaused();
        if (amount == 0) revert InvalidAmount();
        
        // Check if user has enough NFTs
        uint256 userNFTBalance = bearNFT.balanceOf(msg.sender);
        if (userNFTBalance < amount) revert InsufficientNFTBalance();
        
        // Calculate BTB amount to give
        uint256 swapRate = getSwapRate();
        if (swapRate == 0) revert InvalidAmount();
        uint256 baseAmount = swapRate * amount;
        
        // Apply fee (seller receives less)
        uint256 feeAmount = (baseAmount * feePercentage) / 10000;
        uint256 amountToUser = baseAmount - feeAmount;
        
        // Calculate admin's share of the fee
        uint256 adminFeeAmount = (feeAmount * adminFeeShare) / 10000;
        
        // Check contract's BTB balance
        if (btbToken.balanceOf(address(this)) < amountToUser + adminFeeAmount) revert InsufficientBTBBalance();
        
        // Get token IDs to transfer
        uint256[] memory tokenIds = new uint256[](amount);
        uint256 lastIndex = bearNFT.balanceOf(msg.sender) - 1;
        
        // Use reverse selection for gas optimization
        for (uint256 i = 0; i < amount; i++) {
            tokenIds[i] = bearNFT.tokenOfOwnerByIndex(msg.sender, lastIndex - i);
        }
        
        // Transfer NFTs from user to contract
        for (uint256 i = 0; i < amount; i++) {
            bearNFT.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
        }
        
        // Transfer BTB tokens to user
        bool success = btbToken.transfer(msg.sender, amountToUser);
        if (!success) revert TransferFailed();
        
        // Transfer admin fee if applicable
        if (adminFeeAmount > 0 && feeRecipient != address(0)) {
            success = btbToken.transfer(feeRecipient, adminFeeAmount);
            if (success) {
                emit FeesCollected(feeRecipient, adminFeeAmount);
            }
        }
        
        emit SwapNFTForBTB(msg.sender, tokenIds, amountToUser);
        return amountToUser;
    }
    
    /**
     * @dev Pause or unpause swapping
     * @param paused New pause state
     */
    function setSwapPaused(bool paused) external onlyOwner {
        swapPaused = paused;
        emit SwapStatusChanged(paused);
    }
    
    /**
     * @dev Set the fee percentage (in basis points, 100 = 1%)
     * @param newFeePercentage New fee percentage
     */
    function setFeePercentage(uint256 newFeePercentage) external onlyOwner {
        // Limit fee to maximum 100% (10000 basis points)
        if (newFeePercentage > 10000) revert InvalidFeePercentage();
        feePercentage = newFeePercentage;
        emit FeePercentageUpdated(newFeePercentage);
    }
    
    /**
     * @dev Set the admin's share of the fee (in basis points, 5000 = 50%)
     * @param newAdminFeeShare New admin fee share
     */
    function setAdminFeeShare(uint256 newAdminFeeShare) external onlyOwner {
        // Admin fee share must be between 0-100% (0-10000 basis points)
        if (newAdminFeeShare > 10000) revert InvalidFeePercentage();
        adminFeeShare = newAdminFeeShare;
        emit AdminFeeShareUpdated(newAdminFeeShare);
    }
    
    /**
     * @dev Set the fee recipient address
     * @param newFeeRecipient New fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert ZeroAddressNotAllowed();
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(newFeeRecipient);
    }
    
    /**
     * @dev Withdraw BTB tokens (admin only)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawBTB(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        if (amount > btbToken.balanceOf(address(this))) revert InsufficientBTBBalance();
        
        bool success = btbToken.transfer(to, amount);
        if (!success) revert TransferFailed();
    }
    
    /**
     * @dev Withdraw any ERC20 token (admin only)
     * @param token Address of the token to withdraw
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || to == address(0)) revert ZeroAddressNotAllowed();
        
        // Get token symbol for the event (try-catch in case the token doesn't implement metadata)
        string memory symbol = "";
        try IERC20Metadata(token).symbol() returns (string memory s) {
            symbol = s;
        } catch {
            // If symbol() call fails, just use an empty string
        }
        
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        if (amount > balance) {
            amount = balance; // Withdraw all available if requested amount exceeds balance
        }
        
        bool success = tokenContract.transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit TokenWithdrawn(token, to, amount);
    }
    
    /**
     * @dev Withdraw ETH (admin only)
     * @param to Recipient address
     * @param amount Amount to withdraw (in wei)
     */
    function withdrawETH(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        
        uint256 balance = address(this).balance;
        if (amount > balance) {
            amount = balance; // Withdraw all available if requested amount exceeds balance
        }
        
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert ETHTransferFailed();
        
        emit ETHWithdrawn(to, amount);
    }
    
    /**
     * @dev Withdraw specific NFTs (admin only)
     * @param to Recipient address
     * @param tokenIds Array of NFT token IDs to withdraw
     */
    function withdrawNFTs(address to, uint256[] calldata tokenIds) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        
        // First verify all NFTs are owned by the contract
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (bearNFT.ownerOf(tokenIds[i]) != address(this)) revert InsufficientNFTBalance();
        }
        
        // Then transfer all NFTs
        for (uint256 i = 0; i < tokenIds.length; i++) {
            bearNFT.safeTransferFrom(address(this), to, tokenIds[i]);
        }
    }
    
    /**
     * @dev Withdraw multiple NFTs by quantity (admin only)
     * @param to Recipient address
     * @param amount Number of NFTs to withdraw
     * @return tokenIds Array of withdrawn NFT token IDs
     */
    function withdrawNFTsByQuantity(address to, uint256 amount) external onlyOwner nonReentrant returns (uint256[] memory) {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        if (amount == 0) revert InvalidAmount();
        
        // Check if contract has enough NFTs
        uint256 contractNFTBalance = bearNFT.balanceOf(address(this));
        if (contractNFTBalance < amount) revert InsufficientNFTBalance();
        
        // Store NFT IDs first to avoid reentrancy during transfers
        uint256[] memory nftIds = new uint256[](amount);
        uint256 lastIndex = contractNFTBalance - 1;
        
        // Use reverse selection for gas optimization
        for (uint256 i = 0; i < amount; i++) {
            nftIds[i] = bearNFT.tokenOfOwnerByIndex(address(this), lastIndex - i);
        }
        
        // Transfer NFTs after all state changes
        for (uint256 i = 0; i < amount; i++) {
            bearNFT.safeTransferFrom(address(this), to, nftIds[i]);
        }
        
        return nftIds;
    }
    
    /**
     * @dev Get the number of NFT IDs owned by the contract
     * @notice Gas-optimized version that caches the balance in a state variable
     */
    function getContractNFTCount() external view returns (uint256) {
        return bearNFT.balanceOf(address(this));
    }
    
    /**
     * @dev Required for ERC721 receiver
     * Only accepts NFTs from the bearNFT contract
     */
    function onERC721Received(
        address,  // operator
        address,  // from
        uint256,  // tokenId
        bytes calldata  // data
    ) external view returns (bytes4) {
        // Only accept NFTs from the bearNFT contract
        if (msg.sender != address(bearNFT)) {
            revert InvalidNFT();
        }
        
        return this.onERC721Received.selector;
    }
}
