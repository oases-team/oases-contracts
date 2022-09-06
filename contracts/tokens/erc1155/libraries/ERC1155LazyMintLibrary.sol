// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../../common_libraries/PartLibrary.sol";

library ERC1155LazyMintLibrary {

    struct ERC1155LazyMintData {
        uint256 tokenId;
        uint256 supply;
        string tokenURI;
        PartLibrary.Part[] creatorInfos;
        PartLibrary.Part[] royaltyInfos;
        bytes[] signatures;
    }

    bytes4 constant public ERC1155_LAZY_MINT_ASSET_CLASS = bytes4(keccak256("ERC1155_LAZY_MINT_CLASS"));
    bytes4 constant _INTERFACE_ID_MINT_AND_TRANSFER = 0x6db15a0f;
    bytes32 public constant ERC1155_LAZY_MINT_DATA_TYPEHASH = keccak256(
        "Mint1155(uint256 tokenId,uint256 supply,string tokenURI,Part[] creators,Part[] royalties)Part(address account,uint96 value)"
    );

    function getHash(ERC1155LazyMintData memory erc1155LazyMintData) internal pure returns (bytes32) {
        bytes32[] memory creatorInfosHashes = new bytes32[](erc1155LazyMintData.creatorInfos.length);
        for (uint256 i = 0; i < erc1155LazyMintData.creatorInfos.length; ++i) {
            creatorInfosHashes[i] = PartLibrary.getHash(erc1155LazyMintData.creatorInfos[i]);
        }

        bytes32[] memory royaltyInfosHashes = new bytes32[](erc1155LazyMintData.royaltyInfos.length);
        for (uint256 i = 0; i < erc1155LazyMintData.royaltyInfos.length; ++i) {
            royaltyInfosHashes[i] = PartLibrary.getHash(erc1155LazyMintData.royaltyInfos[i]);
        }

        return keccak256(
            abi.encode(
                ERC1155_LAZY_MINT_DATA_TYPEHASH,
                erc1155LazyMintData.tokenId,
                erc1155LazyMintData.supply,
                keccak256(bytes(erc1155LazyMintData.tokenURI)),
                keccak256(abi.encodePacked(creatorInfosHashes)),
                keccak256(abi.encodePacked(royaltyInfosHashes))
            )
        );
    }
}
