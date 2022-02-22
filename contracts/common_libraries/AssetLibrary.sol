// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

library AssetLibrary {

    struct AssetType {
        bytes4 assetClass;
        bytes data;
    }

    struct Asset {
        AssetType assetType;
        uint256 value;
    }

    bytes4 constant public ETH_ASSET_CLASS = bytes4(keccak256("ETH_CLASS"));
    bytes4 constant public ERC20_ASSET_CLASS = bytes4(keccak256("ERC20_CLASS"));
    bytes4 constant public ERC721_ASSET_CLASS = bytes4(keccak256("ERC721_CLASS"));
    bytes4 constant public ERC1155_ASSET_CLASS = bytes4(keccak256("ERC1155_CLASS"));
    bytes4 constant public COLLECTION = bytes4(keccak256("COLLECTION_CLASS"));
    bytes4 constant public CRYPTO_PUNKS = bytes4(keccak256("CRYPTO_PUNKS_CLASS"));

    bytes32 constant ASSET_TYPE_TYPEHASH = keccak256(
        "AssetType(bytes4 assetClass,bytes data)"
    );

    bytes32 constant ASSET_TYPEHASH = keccak256(
        "Asset(AssetType assetType,uint256 value)AssetType(bytes4 assetClass,bytes data)"
    );

    function getHash(AssetType memory assetType) internal pure returns (bytes32){
        return keccak256(
            abi.encode(
                ASSET_TYPE_TYPEHASH,
                assetType.assetClass,
                keccak256(assetType.data)
            )
        );
    }

    function getHash(Asset memory asset) internal pure returns (bytes32){
        return keccak256(
            abi.encode(
                ASSET_TYPEHASH,
                getHash(asset.assetType),
                asset.value
            ));
    }
}
