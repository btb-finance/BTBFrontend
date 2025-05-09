// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {HunterStorage} from "./HunterStorage.sol"; // Import HunterPosition

/**
 * @title TokenURILogic
 * @dev Library for generating on-chain token URI components, like SVGs.
 */
library TokenURILogic {
    /**
     * @dev Generates a placeholder SVG for the Hunter NFT.
     */
    function generateHunterSVG(
        HunterStorage.HunterPosition memory position, 
        uint256 tokenId, 
        uint256 currentTime,
        uint256 recoveryPeriod
    ) internal pure returns (string memory) {
        string memory statusText;
        uint256 LIFESPAN = 365 days;  // Add LIFESPAN constant since libraries can't inherit constants
        if (currentTime > uint256(position.creationTime) + LIFESPAN) {
            statusText = "EXPIRED";
        } else if (position.inHibernation) {
            statusText = "Hibernating";
        } else if (position.recoveryStartTime > 0 && currentTime < uint256(position.recoveryStartTime) + recoveryPeriod) {
            statusText = "Recovering";
        } else {
            statusText = "Active";
        }

        string memory ageText;
        if (currentTime >= position.creationTime) {
            ageText = Strings.toString((currentTime - position.creationTime) / 1 days);
        } else {
            ageText = "0"; // Should not happen if currentTime is block.timestamp
        }

        // Basic SVG representation
        string memory backgroundColor = "#333"; // Default color
        if (keccak256(bytes(statusText)) == keccak256(bytes("EXPIRED"))) {
            backgroundColor = "#8B0000"; // Dark red for expired
        }

        return string(abi.encodePacked(
            '<svg width="350" height="350" xmlns="http://www.w3.org/2000/svg">',
            '<style>.text { font: bold 20px sans-serif; fill: white; }</style>',
            '<rect width="100%" height="100%" fill="', backgroundColor, '"/>',
            '<text x="10" y="30" class="text">Hunter #', Strings.toString(tokenId), '</text>',
            '<text x="10" y="60" class="text">Power: ', Strings.toString(uint256(position.power) / (10**18)), '</text>', // Assuming power has 18 decimals
            '<text x="10" y="90" class="text">Status: ', statusText, '</text>',
            '<text x="10" y="120" class="text">Total Hunted: ', Strings.toString(uint256(position.totalHunted) / (10**18)), '</text>', // Assuming totalHunted has 18 decimals
            '<text x="10" y="150" class="text">Age: ', ageText, ' days</text>',
            '</svg>'
        ));
    }
} 