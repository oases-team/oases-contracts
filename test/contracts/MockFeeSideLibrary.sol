// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/libraries/FeeSideLibrary.sol";

contract MockFeeSideLibrary {
    function getFeeSide(bytes4 makeAssetClass, bytes4 takeAssetClass) external pure returns (FeeSideLibrary.FeeSide){
        return FeeSideLibrary.getFeeSide(makeAssetClass, takeAssetClass);
    }
}
