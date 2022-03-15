// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/interfaces/IAssetTypeMatcher.sol";
import "../../contracts/common_libraries/AssetLibrary.sol";

contract CustomAssetTypeMatcher is IAssetTypeMatcher {

    bytes4 constant public CUSTOM_ASSET_CLASS = bytes4(keccak256("CUSTOM_ASSET_CLASS"));

    function matchAssetTypes(
        AssetLibrary.AssetType memory leftAssetType,
        AssetLibrary.AssetType memory rightAssetType
    )
    external
    pure
    returns
    (AssetLibrary.AssetType memory)
    {
        if (leftAssetType.assetClass == CUSTOM_ASSET_CLASS) {
            (address leftTokenAddress) = abi.decode(leftAssetType.data, (address));
            (address rightTokenAddress) = abi.decode(rightAssetType.data, (address));
            if (leftTokenAddress == rightTokenAddress) {
                return AssetLibrary.AssetType(rightAssetType.assetClass, rightAssetType.data);
            }
        }
        return AssetLibrary.AssetType(0, "");
    }
}
