// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../common_libraries/AssetLibrary.sol";

interface ITransferProxy {
    function transfer(AssetLibrary.Asset memory asset, address from, address to) external;
}
