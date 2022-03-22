// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../common_libraries/AssetLibrary.sol";
import "../interfaces/IAssetTypeMatcher.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract AssetTypeMatcher is OwnableUpgradeable {

    bytes constant EMPTY_BYTES = "";

    mapping(bytes4 => address) assetTypeMatchers;

    event AssetTypeMatcherChange(bytes4 indexed assetType, address matcherAddress);

    // set asset type matcher by the owner of the contract
    function setAssetTypeMatcher(bytes4 assetType, address matcherAddress) external onlyOwner {
        assetTypeMatchers[assetType] = matcherAddress;
        emit AssetTypeMatcherChange(assetType, matcherAddress);
    }

    function generalMatch(
        AssetLibrary.AssetType memory leftAssetType,
        AssetLibrary.AssetType memory rightAssetType
    )
    private
    pure
    returns
    (AssetLibrary.AssetType memory)
    {
        if (keccak256(leftAssetType.data) == keccak256(rightAssetType.data)) {
            return leftAssetType;
        }

        return AssetLibrary.AssetType(0, EMPTY_BYTES);
    }

    function matchAssetTypesByOneSide(
        AssetLibrary.AssetType memory leftAssetType,
        AssetLibrary.AssetType memory rightAssetType
    )
    private
    view
    returns
    (AssetLibrary.AssetType memory)
    {
        bytes4 leftAssetClass = leftAssetType.assetClass;
        bytes4 rightAssetClass = rightAssetType.assetClass;
        if (leftAssetClass == AssetLibrary.ETH_ASSET_CLASS) {
            if (rightAssetClass == AssetLibrary.ETH_ASSET_CLASS) {
                return leftAssetType;
            }

            return AssetLibrary.AssetType(0, EMPTY_BYTES);
        }

        if (leftAssetClass == AssetLibrary.ERC20_ASSET_CLASS) {
            if (rightAssetClass == AssetLibrary.ERC20_ASSET_CLASS) {
                return generalMatch(leftAssetType, rightAssetType);
            }

            return AssetLibrary.AssetType(0, EMPTY_BYTES);
        }

        if (leftAssetClass == AssetLibrary.ERC721_ASSET_CLASS) {
            if (rightAssetClass == AssetLibrary.ERC721_ASSET_CLASS) {
                return generalMatch(leftAssetType, rightAssetType);
            }

            return AssetLibrary.AssetType(0, EMPTY_BYTES);
        }

        if (leftAssetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
            if (rightAssetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
                return generalMatch(leftAssetType, rightAssetType);
            }

            return AssetLibrary.AssetType(0, EMPTY_BYTES);
        }

        // match with the matcher from assetTypeMatchers
        address typeMatcherAddress = assetTypeMatchers[leftAssetClass];
        if (typeMatcherAddress != address(0)) {
            return IAssetTypeMatcher(typeMatcherAddress).matchAssetTypes(leftAssetType, rightAssetType);
        }

        require(leftAssetClass == rightAssetClass, "unknown matching rule");
        return generalMatch(leftAssetType, rightAssetType);
    }

    function matchAssetTypes(
        AssetLibrary.AssetType memory leftAssetType,
        AssetLibrary.AssetType memory rightAssetType
    )
    internal
    view
    returns
    (AssetLibrary.AssetType memory)
    {
        AssetLibrary.AssetType memory matchResult = matchAssetTypesByOneSide(leftAssetType, rightAssetType);
        if (matchResult.assetClass != 0) {
            return matchResult;
        } else {
            return matchAssetTypesByOneSide(rightAssetType, leftAssetType);
        }
    }

    uint256[50] private __gap;
}
