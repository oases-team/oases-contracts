// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../libraries/ERC721LazyMintLibrary.sol";
import "../../../common_libraries/PartLibrary.sol";

interface IERC721LazyMint is IERC721Upgradeable {
    event CreatorInfos(uint256 tokenId, PartLibrary.Part[] creatorInfos);

    function mintAndTransfer(
        ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData,
        address to
    ) external;

    function transferFromOrMint(
        ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData,
        address from,
        address to
    ) external;
}
