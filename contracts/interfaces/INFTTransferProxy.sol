// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

interface INFTTransferProxy {
    function safeTransferFromERC721(
        IERC721Upgradeable addressERC721,
        address from,
        address to,
        uint256 tokenId
    ) external;

    function safeTransferFromERC1155(
        IERC1155Upgradeable addressERC1155,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}
