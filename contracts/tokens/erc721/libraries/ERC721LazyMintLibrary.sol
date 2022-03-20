// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../../common_libraries/PartLibrary.sol";

library ERC721LazyMintLibrary {
    struct ERC721LazyMintData {
        uint256 tokenId;
        string tokenURI;
        PartLibrary.Part[] creatorInfos;
        PartLibrary.Part[] royaltyInfos;
        bytes[] signatures;
    }

    bytes4 public constant ERC721_LAZY_MINT_ASSET_CLASS = bytes4(keccak256("ERC721_LAZY_MINT_CLASS"));
    // TODO: rename '_INTERFACE_ID_MINT_AND_TRANSFER' and calculate the value later
    bytes4 constant _INTERFACE_ID_MINT_AND_TRANSFER = 0x8486f69f;
    bytes32 public constant ERC721_LAZY_MINT_DATA_TYPEHASH =
        keccak256(
            "Mint721(uint256 tokenId,string tokenURI,Part[] creators,Part[] royalties)Part(address account,uint96 value)"
        );

    function getHash(ERC721LazyMintData memory erc721LazyMintData) internal pure returns (bytes32) {
        bytes32[] memory creatorInfosHashes = new bytes32[](
            erc721LazyMintData.creatorInfos.length
        );
        for (uint256 i = 0; i < erc721LazyMintData.creatorInfos.length; ++i) {
            creatorInfosHashes[i] = PartLibrary.getHash(
                erc721LazyMintData.creatorInfos[i]
            );
        }

        bytes32[] memory royaltyInfosHashes = new bytes32[](
            erc721LazyMintData.royaltyInfos.length
        );
        for (uint256 i = 0; i < erc721LazyMintData.royaltyInfos.length; ++i) {
            royaltyInfosHashes[i] = PartLibrary.getHash(
                erc721LazyMintData.royaltyInfos[i]
            );
        }

        return keccak256(
            abi.encode(
                ERC721_LAZY_MINT_DATA_TYPEHASH,
                erc721LazyMintData.tokenId,
                keccak256(bytes(erc721LazyMintData.tokenURI)),
                keccak256(abi.encodePacked(creatorInfosHashes)),
                keccak256(abi.encodePacked(royaltyInfosHashes))
            ));
    }
}
