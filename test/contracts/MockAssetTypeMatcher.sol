// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/AssetTypeMatcher.sol";
import "../../contracts/common_libraries/AssetLibrary.sol";

contract MockAssetTypeMatcher is AssetTypeMatcher {

    function __MockAssetTypeMatcher_init() external initializer {
        __Ownable_init_unchained();
    }

    function mockMatchAssetTypes(
        AssetLibrary.AssetType calldata leftAssetType,
        AssetLibrary.AssetType calldata rightAssetType
    )
    external
    view
    returns
    (AssetLibrary.AssetType memory) {
        return matchAssetTypes(leftAssetType, rightAssetType);
    }
}
