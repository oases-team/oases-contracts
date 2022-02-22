// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../common_libraries/AssetLibrary.sol";
import "./MathLibrary.sol";

library OrderLibrary {

    struct Order {
        address maker;
        AssetLibrary.Asset makeAsset;
        address taker;
        AssetLibrary.Asset takeAsset;
        uint256 salt;
        uint256 startTime;
        uint256 endTime;
        bytes4 dataType;
        bytes data;
    }

    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,Asset makeAsset,address taker,Asset takeAsset,uint256 salt,uint256 startTime,uint256 endTime,bytes4 dataType,bytes data)Asset(AssetType assetType,uint256 value)AssetType(bytes4 assetClass,bytes data)"
    );

    function checkTimeValidity(Order memory order) internal view {
        uint256 currentTimestamp = block.timestamp;
        require(order.startTime == 0 || order.startTime < currentTimestamp, "Order start validation failed");
        require(order.endTime == 0 || order.endTime > currentTimestamp, "Order end validation failed");
    }

    function getHash(Order memory order) internal pure returns (bytes32){
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.maker,
                AssetLibrary.getHash(order.makeAsset),
                order.taker,
                AssetLibrary.getHash(order.makeAsset),
                order.salt,
                order.startTime,
                order.endTime,
                order.dataType,
                keccak256(order.data)
            )
        );
    }

    function getHashKey(Order memory order) internal pure returns (bytes32){
        return keccak256(
            abi.encode(
                order.maker,
                AssetLibrary.getHash(order.makeAsset.assetType),
                AssetLibrary.getHash(order.takeAsset.assetType),
                order.salt,
                order.data
            )
        );
    }

    function calculateRemainingValuesInOrder(
        Order memory order,
        uint256 fill,
        bool isMakeFill
    )
    internal
    pure
    returns
    (uint256 makeRemainingValue, uint256 takeRemainingValue)
    {
        if (isMakeFill) {
            makeRemainingValue = order.makeAsset.value - fill;
            takeRemainingValue = MathLibrary.safeGetPartialAmountWithFloorRounding(
                order.takeAsset.value,
                order.makeAsset.value,
                makeRemainingValue
            );
        } else {
            takeRemainingValue = order.takeAsset.value - fill;
            makeRemainingValue = MathLibrary.safeGetPartialAmountWithFloorRounding(
                order.makeAsset.value,
                order.takeAsset.value,
                takeRemainingValue
            );
        }
    }
}
