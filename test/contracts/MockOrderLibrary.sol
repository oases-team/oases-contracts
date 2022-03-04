// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
//pragma abicoder v2;

import "../../contracts/oases_exchange/libraries/OrderLibrary.sol";

contract MockOrderLibrary {
    function checkTimeValidity(OrderLibrary.Order memory order) external view {
        OrderLibrary.checkTimeValidity(order);
    }

    function getHashKey(OrderLibrary.Order memory order) external pure returns (bytes32){
        return OrderLibrary.getHashKey(order);
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
