// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/oases_exchange/libraries/OrderLibrary.sol";

contract MockOrderLibrary {
    function checkTimeValidity(OrderLibrary.Order memory order) external view {
        OrderLibrary.checkTimeValidity(order);
    }

    function getHashKey(OrderLibrary.Order memory order) external pure returns (bytes32){
        return OrderLibrary.getHashKey(order);
    }

    function getHash(OrderLibrary.Order memory order) external pure returns (bytes32){
        return OrderLibrary.getHash(order);
    }

    function mockGetHashKey(OrderLibrary.Order memory order) external pure returns (bytes32){
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

    function mockGetHash(OrderLibrary.Order memory order) external pure returns (bytes32){
        return keccak256(
            abi.encode(
                OrderLibrary.ORDER_TYPEHASH,
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

    function calculateRemainingValuesInOrder(
        OrderLibrary.Order memory order,
        uint256 fill,
        bool isMakeFill
    )
    external
    pure
    returns
    (uint256 makeRemainingValue, uint256 takeRemainingValue)
    {
        return OrderLibrary.calculateRemainingValuesInOrder(order, fill, isMakeFill);
    }
}
