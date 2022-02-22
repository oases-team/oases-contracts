// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../common_libraries/AssetLibrary.sol";

library FeeSideLibrary {

    enum FeeSide {NONE, MAKE, TAKE}

    function getFeeSide(bytes4 makeAssetClass, bytes4 takeAssetClass) internal pure returns (FeeSide){
        FeeSide feeSide = FeeSide.NONE;
        if (makeAssetClass == AssetLibrary.ETH_ASSET_CLASS) {
            feeSide = FeeSide.MAKE;
        } else if (takeAssetClass == AssetLibrary.ETH_ASSET_CLASS) {
            feeSide = FeeSide.TAKE;
        } else if (makeAssetClass == AssetLibrary.ERC20_ASSET_CLASS) {
            feeSide = FeeSide.MAKE;
        } else if (takeAssetClass == AssetLibrary.ERC20_ASSET_CLASS) {
            feeSide = FeeSide.TAKE;
        } else if (makeAssetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
            feeSide = FeeSide.MAKE;
        } else if (takeAssetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
            feeSide = FeeSide.TAKE;
        }

        return feeSide;
    }
}
