// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./AssetTypeMatcher.sol";
import "./Cashier.sol";
import "./OrderVerifier.sol";
import "./libraries/TransferHelperLibrary.sol";
import "./libraries/OrderLibrary.sol";
import "./libraries/OrderDataParsingLibrary.sol";
import "./libraries/FillLibrary.sol";
import "./interfaces/ICashierManager.sol";
import "../common_libraries/AssetLibrary.sol";

abstract contract OasesMatchingCore is AssetTypeMatcher, Cashier, OrderVerifier, ICashierManager {
    using TransferHelperLibrary for address;

    // record the filled amount of each order
    mapping(bytes32 => uint256) filledRecords;

    event CancelOrder(
        bytes32 orderHashKey,
        address orderMaker,
        AssetLibrary.AssetType makeAssetType,
        AssetLibrary.AssetType takeAssetType
    );

    event Trade(
        bytes32 leftOrderHashKey,
        bytes32 rightOrderHashKey,
        address leftOrderMaker,
        address rightOrderMaker,
        uint256 fillResultLeftValue,
        uint256 fillResultRightValue,
        AssetLibrary.AssetType matchedMakeAssetType,
        AssetLibrary.AssetType matchedTakeAssetType
    );

    function cancelOrders(OrderLibrary.Order[] calldata orders) external {
        uint len = orders.length;
        for (uint256 i = 0; i < len; ++i) {
            OrderLibrary.Order memory order = orders[i];
            require(msg.sender == order.maker, "not the order maker");
            require(order.salt != 0, "salt 0 cannot be cancelled");
            bytes32 orderKeyHash = OrderLibrary.getHashKey(order);
            filledRecords[orderKeyHash] = type(uint256).max;

            emit CancelOrder(
                orderKeyHash,
                order.maker,
                order.makeAsset.assetType,
                order.takeAsset.assetType
            );
        }
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

        FillLibrary.FillResult memory fillResult = getFillResult(
            leftOrder,
            rightOrder,
            leftOrderHashKey,
            rightOrderHashKey,
            leftOrderData,
            rightOrderData
        );

        (uint256 totalMakeAmount, uint256 totalTakeAmount) = allocateAssets(
            fillResult,
            matchedMakeAssetType,
            matchedTakeAssetType,
            leftOrder,
            rightOrder,
            leftOrderData,
            rightOrderData
        );

        // transfer extra eth
        if (matchedMakeAssetType.assetClass == AssetLibrary.ETH_ASSET_CLASS) {
            require(matchedTakeAssetType.assetClass != AssetLibrary.ETH_ASSET_CLASS);
            uint256 ethAmount = msg.value;
            require(ethAmount >= totalMakeAmount, "insufficient eth");
            if (ethAmount > totalMakeAmount) {
                address(msg.sender).transferEth(ethAmount - totalMakeAmount);
            }
        } else if (matchedTakeAssetType.assetClass == AssetLibrary.ETH_ASSET_CLASS) {
            uint256 ethAmount = msg.value;
            require(ethAmount >= totalTakeAmount, "insufficient eth");
            if (ethAmount > totalTakeAmount) {
                address(msg.sender).transferEth(ethAmount - totalTakeAmount);
            }
        }

        emit Trade(
            leftOrderHashKey,
            rightOrderHashKey,
            leftOrder.maker,
            rightOrder.maker,
            fillResult.leftValue,
            fillResult.rightValue,
            matchedMakeAssetType,
            matchedTakeAssetType
        );
    }

    function getFillResult(
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder,
        bytes32 leftOrderHashKey,
        bytes32 rightOrderHashKey,
        OrderDataLibrary.Data memory leftOrderData,
        OrderDataLibrary.Data memory rightOrderData
    )
    internal
    returns
    (FillLibrary.FillResult memory fillResult)
    {
        uint256 leftOrderFillRecord = getOrderFilledRecord(leftOrder.salt, leftOrderHashKey);
        uint256 rightOrderFillRecord = getOrderFilledRecord(rightOrder.salt, rightOrderHashKey);

        fillResult = FillLibrary.fillOrders(
            leftOrder,
            rightOrder,
            leftOrderFillRecord,
            rightOrderFillRecord,
            leftOrderData.isMakeFill,
            rightOrderData.isMakeFill
        );

        require(fillResult.rightValue > 0 && fillResult.leftValue > 0, "null fill");

        if (leftOrder.salt != 0) {
            if (leftOrderData.isMakeFill) {
                filledRecords[leftOrderHashKey] = leftOrderFillRecord + fillResult.leftValue;
            } else {
                filledRecords[leftOrderHashKey] = leftOrderFillRecord + fillResult.rightValue;
            }
        }

        if (rightOrder.salt != 0) {
            if (rightOrderData.isMakeFill) {
                filledRecords[rightOrderHashKey] = rightOrderFillRecord + fillResult.rightValue;
            } else {
                filledRecords[rightOrderHashKey] = rightOrderFillRecord + fillResult.leftValue;
            }
        }
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
        uint256 orderSalt,
        bytes32 orderHashKey
    )
    internal
    view
    returns
    (uint256){
        if (orderSalt == 0) {
            return 0;
        } else {
            return filledRecords[orderHashKey];
        }
    }

    uint256[50] private __gap;
}
