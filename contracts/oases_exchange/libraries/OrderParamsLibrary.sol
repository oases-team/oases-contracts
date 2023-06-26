// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../common_libraries/AssetLibrary.sol";
import "./OrderLibrary.sol";
import "./OrderDataLibrary.sol";
import "./FillLibrary.sol";

library OrderParamsLibrary {
    struct OrderParams {
        OrderLibrary.Order order;
        OrderDataLibrary.Data orderData;
        AssetLibrary.AssetType assetType;
        bytes32 orderHashKey;
        uint256 totalAmount;
    }
}
