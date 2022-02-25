// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../common_libraries/AssetLibrary.sol";

abstract contract ICashier {
    event Transfer(AssetLibrary.Asset asset, address from, address to, bytes4 direction, bytes4 transferType);

    function transfer(
        AssetLibrary.Asset memory asset,
        address from,
        address to,
        bytes4 transferType,
        bytes4 direction
    ) internal virtual;
}
