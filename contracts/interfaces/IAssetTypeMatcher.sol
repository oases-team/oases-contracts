// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../common_libraries/AssetLibrary.sol";

interface IAssetTypeMatcher {
    function matchAssetTypes(
        AssetLibrary.AssetType memory leftAssetType,
        AssetLibrary.AssetType memory rightAssetType
    )
    external
    view
    returns
    (AssetLibrary.AssetType memory);
}
