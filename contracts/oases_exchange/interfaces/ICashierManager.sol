// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../interfaces/ICashier.sol";
import "../../common_libraries/AssetLibrary.sol";
import "../libraries/FillLibrary.sol";
import "../libraries/OrderLibrary.sol";
import "../libraries/OrderDataLibrary.sol";

abstract contract ICashierManager is ICashier {
    // transfer direction
    bytes4 constant TO_MAKER = bytes4(keccak256("TO_MAKER_DIRECTION"));
    bytes4 constant TO_TAKER = bytes4(keccak256("TO_TAKER_DIRECTION"));

    // transfer type
    bytes4 constant PROTOCOL = bytes4(keccak256("PROTOCOL_TYPE"));
    bytes4 constant ROYALTY = bytes4(keccak256("ROYALTY_TYPE"));
    bytes4 constant ORIGIN = bytes4(keccak256("ORIGIN_TYPE"));
    bytes4 constant PAYOUT = bytes4(keccak256("PAYOUT_TYPE"));

    function allocateAssets(
        FillLibrary.FillResult memory fillResult,
        AssetLibrary.AssetType memory matchedMakeAssetType,
        AssetLibrary.AssetType memory matchedTakeAssetType,
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder,
        OrderDataLibrary.Data memory leftOrderData,
        OrderDataLibrary.Data memory rightOrderData
    ) internal virtual returns (uint256 totalMakeAmount, uint256 totalTakeAmount);
}
