// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

library BasisPointLibrary {
    function basisPointCalculate(uint256 value, uint256 basisPointValue) internal pure returns (uint256) {
        return value * basisPointValue / 10000;
    }
}
