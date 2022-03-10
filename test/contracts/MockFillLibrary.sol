// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/libraries/OrderLibrary.sol";
import "../../contracts/oases_exchange/libraries/FillLibrary.sol";

contract MockFillLibrary {
    function fillOrders(
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder,
        uint256 leftOrderFillRecord,
        uint256 rightOrderFillRecord,
        bool leftOrderIsMakeFill,
        bool rightOrderIsMakeFill
    )
    public
    pure
    returns
    (FillLibrary.FillResult memory)
    {
        return FillLibrary.fillOrders(
            leftOrder,
            rightOrder,
            leftOrderFillRecord,
            rightOrderFillRecord,
            leftOrderIsMakeFill,
            rightOrderIsMakeFill
        );
    }
}
