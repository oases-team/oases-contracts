// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract MockERC721 is ERC721Upgradeable {
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
