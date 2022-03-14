// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract MockBadERC721 is ERC721Upgradeable {
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function safeTransferFrom(address, address, uint256) public virtual override {
        revert();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override {
        revert();
    }
}
