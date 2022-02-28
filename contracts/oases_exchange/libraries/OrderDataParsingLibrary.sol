// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./OrderLibrary.sol";
import "./OrderDataLibrary.sol";

library OrderDataParsingLibrary {
    function parse(OrderLibrary.Order memory order) pure internal returns (OrderDataLibrary.Data memory orderData){
        if (order.dataType == OrderDataLibrary.V1) {
            orderData = OrderDataLibrary.decodeData(order.data);
        } else {
            require(order.dataType == 0xffffffff, "unsupported order data type");
        }

        if (orderData.payoutInfos.length == 0) {
            orderData.payoutInfos = new PartLibrary.Part[](1);
            orderData.payoutInfos[0].account = payable(order.maker);
            orderData.payoutInfos[0].value = 10000;
        }
    }
}
