// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./AssetTypeMatcher.sol";
import "./Cashier.sol";
import "./OrderVerifier.sol";
import "./libraries/TransferHelperLibrary.sol";
import "./libraries/OrderLibrary.sol";
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

    // get filled record of each order by its order key hash
    function getFilledRecords(bytes32 orderKeyHash) public view returns (uint256){
        return filledRecords[orderKeyHash];
    }
}