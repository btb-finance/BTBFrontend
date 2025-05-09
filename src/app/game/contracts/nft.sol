// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BearNFT is ERC721, ERC721Enumerable, ERC2981, Ownable, ReentrancyGuard {
    // Custom errors for gas optimization
    error MaxSupplyReached();
    error WouldExceedMaxSupply();
    error NoRecipientsProvided();
    error ZeroAddressNotAllowed();
    error PaymentTokenNotSet();
    error MustBuyAtLeastOneNFT();
    error InsufficientTokenBalance();
    error InsufficientTokenAllowance();
    error TokenTransferFailed();
    error NonexistentToken();
    
    // Start token ID from 1 instead of 0
    uint256 private _nextTokenId = 1;
    
    // Maximum supply of NFTs
    uint256 public constant MAX_SUPPLY = 100000;
    
    // Base URIs for metadata - first 50K and second 50K
    string private _baseTokenURI1;
    string private _baseTokenURI2;
    
    // The cutoff point for different metadata
    uint256 private constant METADATA_CUTOFF = 50000;
    
    // Payment token contract
    IERC20 public paymentToken;
    
    // Price per NFT in payment tokens
    uint256 public pricePerNFT;
    
    // Flag to check if payment token is set
    bool private _isPaymentTokenSet;
    
    constructor(address initialOwner)
        ERC721("BEAR", "BEAR")
        Ownable(initialOwner)
    {
        // Initialize with IPFS metadata URIs
        _baseTokenURI1 = "https://bafybeigno53qh4ytkvk2klc43qxvkqydfaa3k7l6j4bh46ftjazompw2fu.ipfs.w3s.link/";
        _baseTokenURI2 = "https://bafybeiebv3hldg7ra6wq3jrarywtcaob2iimgbjnd7uwldkm767udbdfs4.ipfs.w3s.link/";
        
        // Set default royalty to 5% to the contract creator
        _setDefaultRoyalty(initialOwner, 500); // 500 = 5%
    }
    
    /**
     * @dev Sets the payment token address and price
     */
    function setPaymentToken(address _paymentToken, uint256 _pricePerNFT) public onlyOwner {
        paymentToken = IERC20(_paymentToken);
        pricePerNFT = _pricePerNFT;
        _isPaymentTokenSet = true;
    }
    
    /**
     * @dev Updates the royalty information for the collection
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }
    
    /**
     * @dev Removes default royalty information
     */
    function deleteDefaultRoyalty() public onlyOwner {
        _deleteDefaultRoyalty();
    }
    
    /**
     * @dev Sets token-specific royalty information
     */
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) public onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }
    
    /**
     * @dev Base URI for computing {tokenURI}
     */
    function _baseURI() internal pure override returns (string memory) {
    return "";  // This will be ignored as we customize tokenURI directly
}
    
    /**
     * @dev Sets the base URIs for metadata
     */
    function setBaseURIs(string memory baseURI1, string memory baseURI2) public onlyOwner {
        _baseTokenURI1 = baseURI1;
        _baseTokenURI2 = baseURI2;
    }
    
    /**
     * @dev Update the price per NFT
     */
    function setPricePerNFT(uint256 _newPrice) public onlyOwner {
        pricePerNFT = _newPrice;
    }
    
    /**
     * @dev See {IERC721-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken();
        
        string memory baseURI;
        if (tokenId <= METADATA_CUTOFF) {
            baseURI = _baseTokenURI1;
        } else {
            baseURI = _baseTokenURI2;
        }
        
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, _toString(tokenId), ".json")) : "";
    }
    
    /**
     * @dev Helper function to convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        
        uint256 temp = value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    /**
     * @dev Returns whether `tokenId` exists.
     * Fixed implementation to use _ownerOf instead of ownerOf
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev Mint a single NFT (admin only)
     */
    function safeMint(address to) public onlyOwner returns (uint256) {
        if (_nextTokenId > MAX_SUPPLY) revert MaxSupplyReached();
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
    
    /**
     * @dev Batch mint multiple NFTs (admin only)
     */
    function batchMint(address to, uint256 amount) public onlyOwner returns (uint256[] memory) {
        if (_nextTokenId + amount - 1 > MAX_SUPPLY) revert WouldExceedMaxSupply();
        
        uint256[] memory tokenIds = new uint256[](amount);
        
        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            tokenIds[i] = tokenId;
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Airdrop NFTs to multiple recipients (admin only)
     */
    function airdropNFTs(address[] calldata recipients) public onlyOwner returns (uint256[] memory) {
        uint256 recipientCount = recipients.length;
        if (recipientCount == 0) revert NoRecipientsProvided();
        if (_nextTokenId + recipientCount - 1 > MAX_SUPPLY) revert WouldExceedMaxSupply();
        
        uint256[] memory tokenIds = new uint256[](recipientCount);
        
        for (uint256 i = 0; i < recipientCount; i++) {
            if (recipients[i] == address(0)) revert ZeroAddressNotAllowed();
            
            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);
            tokenIds[i] = tokenId;
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Allow users to buy NFTs with payment tokens
     * Added balance and allowance checks
     */
    function buyNFT(uint256 amount) public nonReentrant returns (uint256[] memory) {
        if (!_isPaymentTokenSet) revert PaymentTokenNotSet();
        if (amount == 0) revert MustBuyAtLeastOneNFT();
        if (_nextTokenId + amount - 1 > MAX_SUPPLY) revert WouldExceedMaxSupply();
        
        uint256 totalPrice = pricePerNFT * amount;
        
        // Check balance and allowance before attempting transfer
        if (paymentToken.balanceOf(msg.sender) < totalPrice) revert InsufficientTokenBalance();
        if (paymentToken.allowance(msg.sender, address(this)) < totalPrice) revert InsufficientTokenAllowance();
        
        // Transfer payment tokens from buyer to contract
        if (!paymentToken.transferFrom(msg.sender, address(this), totalPrice)) revert TokenTransferFailed();
        
        // Mint NFTs to buyer
        uint256[] memory tokenIds = new uint256[](amount);
        
        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
            tokenIds[i] = tokenId;
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Withdraw payment tokens from contract (admin only)
     */
    function withdrawTokens(address to, uint256 amount) public onlyOwner nonReentrant {
        if (!_isPaymentTokenSet) revert PaymentTokenNotSet();
        if (!paymentToken.transfer(to, amount)) revert TokenTransferFailed();
    }
    
    /**
     * @dev Get current price for a specific amount of NFTs
     */
    function getPrice(uint256 amount) public view returns (uint256) {
        return pricePerNFT * amount;
    }
    
    /**
     * @dev Get total minted NFTs
     */
    function totalMinted() public view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    /**
     * @dev Get remaining NFTs that can be minted
     */
    function remainingSupply() public view returns (uint256) {
        return MAX_SUPPLY - (_nextTokenId - 1);
    }
    
    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}