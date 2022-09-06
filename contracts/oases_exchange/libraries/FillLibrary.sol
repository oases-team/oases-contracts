// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./OrderLibrary.sol";
import "./MathLibrary.sol";

library FillLibrary {

    struct FillResult {
        uint256 leftValue;
        uint256 rightValue;
    }

    function fillOrders(
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder,
        uint256 leftOrderFillRecord,
        uint256 rightOrderFillRecord,
        bool leftOrderIsMakeFill,
        bool rightOrderIsMakeFill
    )
    internal
    pure
    returns
    (FillResult memory fillResult)
    {
        (uint256 leftOrderMakeValue,uint256 leftOrderTakeValue) = OrderLibrary.calculateRemainingValuesInOrder(
            leftOrder,
            leftOrderFillRecord,
            leftOrderIsMakeFill
        );

        (uint256 rightOrderMakeValue,uint256 rightOrderTakeValue) = OrderLibrary.calculateRemainingValuesInOrder(
            rightOrder,
            rightOrderFillRecord,
            rightOrderIsMakeFill
        );

        if (rightOrderTakeValue > leftOrderMakeValue) {
            // left order will be filled fully this time
            uint256 rightShouldTakeAsRightRate = MathLibrary.safeGetPartialAmountWithFloorRounding(
                leftOrderTakeValue,
                rightOrder.makeAsset.value,
                rightOrder.takeAsset.value
            );
            require(rightShouldTakeAsRightRate <= leftOrderMakeValue, "bad fill when left order should be filled fully");
            fillResult.leftValue = leftOrderMakeValue;
            fillResult.rightValue = leftOrderTakeValue;
        } else {
            // right order will be filled fully this time
            // or
            // both of left and right ones will be fully filled together
            uint256 leftShouldMakeAsLeftRate = MathLibrary.safeGetPartialAmountWithFloorRounding(
                rightOrderTakeValue,
                leftOrder.makeAsset.value,
                leftOrder.takeAsset.value
            );
            require(leftShouldMakeAsLeftRate <= rightOrderMakeValue, "bad fill when right order or both sides should be filled fully");
            fillResult.leftValue = rightOrderTakeValue;
            fillResult.rightValue = leftShouldMakeAsLeftRate;
        }
    }
}
