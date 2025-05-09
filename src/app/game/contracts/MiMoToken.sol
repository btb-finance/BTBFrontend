// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MiMoGaMe is ERC20, ERC20Burnable, Ownable, ERC1363, ERC20Permit {
    address public gameContractAddress;

    event GameContractAddressSet(address indexed newGameContractAddress);

    modifier onlyGameContract() {
        require(msg.sender == gameContractAddress, "MiMoGaMe: Caller is not the authorized game contract");
        _;
    }

    constructor(address recipient, address initialOwner)
        ERC20("MiMo GaMe", "MiMo")
        Ownable(initialOwner)
        ERC20Permit("MiMo GaMe")
    {
        _mint(recipient, 1 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function setGameContractAddress(address _gameContractAddress) external onlyOwner {
        require(_gameContractAddress != address(0), "MiMoGaMe: Game contract address cannot be zero");
        gameContractAddress = _gameContractAddress;
        emit GameContractAddressSet(_gameContractAddress);
    }

    /**
     * @dev Allows the designated game contract to transfer tokens from any account.
     * This bypasses standard allowance checks. Use with extreme caution.
     */
    function forceTransferFrom(address from, address to, uint256 amount) external onlyGameContract {
        _transfer(from, to, amount);
    }

    /**
     * @dev Allows the designated game contract to burn tokens from any account.
     * This bypasses standard allowance checks. Use with extreme caution.
     */
    function forceBurnFrom(address from, uint256 amount) external onlyGameContract {
        _burn(from, amount);
    }
}