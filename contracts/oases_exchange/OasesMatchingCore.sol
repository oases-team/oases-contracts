// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./AssetTypeMatcher.sol";
import "./Cashier.sol";
import "./OrderVerifier.sol";
import "./libraries/TransferHelperLibrary.sol";
import "./libraries/OrderLibrary.sol";
import "./libraries/OrderDataParsingLibrary.sol";
import "../common_libraries/AssetLibrary.sol";

abstract contract OasesMatchingCore is AssetTypeMatcher, Cashier, OrderVerifier {
    using TransferHelperLibrary for address;

    // record the filled amount of each order
    mapping(bytes32 => uint256) filledRecords;

    event CancelOrder(
        bytes32 orderHashKey,
        address orderMaker,
        AssetLibrary.AssetType makeAssetType,
        AssetLibrary.AssetType takeAssetType
    );

    function cancelOrder(OrderLibrary.Order memory order) external {
        require(msg.sender == order.maker, "not the order maker");
        require(order.salt != 0, "salt 0 cannot be cancelled");
        bytes32 orderKeyHash = OrderLibrary.getHash(order);
        filledRecords[orderKeyHash] = type(uint256).max;

        emit CancelOrder(
            orderKeyHash,
            order.maker,
            order.makeAsset.assetType,
            order.takeAsset.assetType
        );
    }

    function matchOrders(
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder,
        bytes calldata leftSignature,
        bytes calldata rightSignature
    )
    external
    payable
    {
        validateOrder(leftOrder, leftSignature);
        validateOrder(rightOrder, rightSignature);
        if (leftOrder.taker != address(0)) {
            require(rightOrder.maker == leftOrder.taker, "unmatched taker of left order");
        }
        if (rightOrder.taker != address(0)) {
            require(rightOrder.taker == leftOrder.maker, "unmatched taker of right order");
        }

        trade(leftOrder, rightOrder);
    }

    function trade(OrderLibrary.Order memory leftOrder, OrderLibrary.Order memory rightOrder) internal {
        (
        AssetLibrary.AssetType memory matchedMakeAssetType,
        AssetLibrary.AssetType memory matchedTakeAssetType
        ) = matchAssetTypesFromOrders(leftOrder, rightOrder);

        bytes32 leftOrderHashKey = OrderLibrary.getHashKey(leftOrder);
        bytes32 rightOrderHashKey = OrderLibrary.getHashKey(rightOrder);

        OrderDataLibrary.Data memory leftOrderData = OrderDataParsingLibrary.parse(leftOrder);
        OrderDataLibrary.Data memory rightOrderData = OrderDataParsingLibrary.parse(rightOrder);
    }

    function matchAssetTypesFromOrders(
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder
    )
    internal
    view
    returns
    (AssetLibrary.AssetType memory matchedMakeAssetType, AssetLibrary.AssetType memory matchedTakeAssetType)
    {
        matchedMakeAssetType = matchAssetTypes(leftOrder.makeAsset.assetType, rightOrder.takeAsset.assetType);
        require(matchedMakeAssetType.assetClass != 0, "bad match of make asset");
        matchedTakeAssetType = matchAssetTypes(leftOrder.takeAsset.assetType, rightOrder.makeAsset.assetType);
        require(matchedTakeAssetType.assetClass != 0, "bad match of take asset");
    }

    // get filled record of each order by its order key hash
    function getFilledRecords(bytes32 orderKeyHash) public view returns (uint256){
        return filledRecords[orderKeyHash];
    }

    function validateOrder(OrderLibrary.Order memory order, bytes memory signature) internal view {
        OrderLibrary.checkTimeValidity(order);
        verifyOrder(order, signature);
    }

    function getOrderFilledRecord(
        OrderLibrary.Order memory order,
        bytes32 orderHashKey
    )
    internal
    view
    returns
    (uint256){
        if (order.salt == 0) {
            return 0;
        } else {
            return filledRecords[orderHashKey];
        }
    }

    uint256[49] private __gap;
}