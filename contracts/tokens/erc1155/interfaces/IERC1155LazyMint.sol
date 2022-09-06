// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "../libraries/ERC1155LazyMintLibrary.sol";
import "../../../common_libraries/PartLibrary.sol";

interface IERC1155LazyMint is IERC1155Upgradeable {
    event Supply(uint256 tokenId, uint256 value);

    event CreatorInfos(uint256 tokenId, PartLibrary.Part[] creators);

    function mintAndTransfer(
        ERC1155LazyMintLibrary.ERC1155LazyMintData memory erc1155LazyMintData,
        address to,
        uint256 amount
    ) external;

    function transferFromOrMint(
        ERC1155LazyMintLibrary.ERC1155LazyMintData memory erc1155LazyMintData,
        address from,
        address to,
        uint256 amount
    ) external;
}
