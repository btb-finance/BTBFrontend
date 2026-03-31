// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BTB Bear NFT
/// @notice NFT collection with ETH minting fee (0.01 ETH per NFT)
/// @dev Fees are transferred directly to admin address
contract BearNFT is ERC721, ERC721Enumerable, ERC2981, Ownable, ReentrancyGuard {
    // Custom errors
    error MaxSupplyReached();
    error WouldExceedMaxSupply();
    error NoRecipientsProvided();
    error ZeroAddressNotAllowed();
    error MustBuyAtLeastOneNFT();
    error InsufficientETH();
    error ETHTransferFailed();
    error NonexistentToken();
    
    // Start token ID from 1
    uint256 private _nextTokenId = 1;
    
    // Maximum supply
    uint256 public constant MAX_SUPPLY = 100000;
    
    // Price per NFT in ETH (0.01 ETH = 1e15 wei)
    uint256 public pricePerNFT = 0.01 ether;
    
    // Admin address that receives minting fees
    address public feeRecipient;
    
    // Base URIs for metadata
    string private _baseTokenURI1;
    string private _baseTokenURI2;
    uint256 private constant METADATA_CUTOFF = 50000;
    
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event NFTsPurchased(address indexed buyer, uint256 amount, uint256 totalPrice);
    
    constructor(address initialOwner, address _feeRecipient)
        ERC721("BTB Bear", "BEAR")
        Ownable(initialOwner)
    {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        
        // IPFS metadata URIs
        _baseTokenURI1 = "https://bafybeigno53qh4ytkvk2klc43qxvkqydfaa3k7l6j4bh46ftjazompw2fu.ipfs.w3s.link/";
        _baseTokenURI2 = "https://bafybeiebv3hldg7ra6wq3jrarywtcaob2iimgbjnd7uwldkm767udbdfs4.ipfs.w3s.link/";
        
        // 5% royalty to owner
        _setDefaultRoyalty(initialOwner, 500);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set the fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        address oldRecipient = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }
    
    /**
     * @notice Update the price per NFT
     */
    function setPricePerNFT(uint256 _newPrice) external onlyOwner {
        uint256 oldPrice = pricePerNFT;
        pricePerNFT = _newPrice;
        emit PriceUpdated(oldPrice, _newPrice);
    }
    
    /**
     * @notice Set base URIs for metadata
     */
    function setBaseURIs(string memory baseURI1, string memory baseURI2) external onlyOwner {
        _baseTokenURI1 = baseURI1;
        _baseTokenURI2 = baseURI2;
    }
    
    /**
     * @notice Set default royalty
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          MINT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Buy NFTs with ETH (0.01 ETH per NFT)
     * @param amount Number of NFTs to buy
     */
    function buyNFT(uint256 amount) external payable nonReentrant returns (uint256[] memory) {
        if (amount == 0) revert MustBuyAtLeastOneNFT();
        if (_nextTokenId + amount - 1 > MAX_SUPPLY) revert WouldExceedMaxSupply();
        
        uint256 totalPrice = pricePerNFT * amount;
        if (msg.value < totalPrice) revert InsufficientETH();
        
        // Transfer ETH to fee recipient
        (bool success, ) = feeRecipient.call{value: totalPrice}("");
        if (!success) revert ETHTransferFailed();
        
        // Refund excess ETH
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalPrice}("");
            if (!refundSuccess) revert ETHTransferFailed();
        }
        
        // Mint NFTs
        uint256[] memory tokenIds = new uint256[](amount);
        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
            tokenIds[i] = tokenId;
        }
        
        emit NFTsPurchased(msg.sender, amount, totalPrice);
        return tokenIds;
    }
    
    /**
     * @notice Admin mint (free, for airdrops/giveaways)
     */
    function safeMint(address to) external onlyOwner returns (uint256) {
        if (_nextTokenId > MAX_SUPPLY) revert MaxSupplyReached();
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
    
    /**
     * @notice Admin batch mint
     */
    function batchMint(address to, uint256 amount) external onlyOwner returns (uint256[] memory) {
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
     * @notice Airdrop to multiple recipients
     */
    function airdropNFTs(address[] calldata recipients) external onlyOwner returns (uint256[] memory) {
        uint256 count = recipients.length;
        if (count == 0) revert NoRecipientsProvided();
        if (_nextTokenId + count - 1 > MAX_SUPPLY) revert WouldExceedMaxSupply();
        
        uint256[] memory tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            if (recipients[i] == address(0)) revert ZeroAddressNotAllowed();
            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);
            tokenIds[i] = tokenId;
        }
        return tokenIds;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get price for amount of NFTs
     */
    function getPrice(uint256 amount) external view returns (uint256) {
        return pricePerNFT * amount;
    }
    
    /**
     * @notice Total minted
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    /**
     * @notice Remaining supply
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - (_nextTokenId - 1);
    }
    
    /**
     * @notice Token URI with different metadata for first/second 50K
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        
        string memory baseURI = tokenId <= METADATA_CUTOFF ? _baseTokenURI1 : _baseTokenURI2;
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, _toString(tokenId), ".json")) : "";
    }
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
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
    
    function _baseURI() internal pure override returns (string memory) {
        return "";
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          REQUIRED OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════
    
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}