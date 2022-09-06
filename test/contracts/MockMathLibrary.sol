// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/oases_exchange/libraries/MathLibrary.sol";

contract MockMathLibrary {
    function safeGetPartialAmountWithFloorRounding(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    )
    external
    pure
    returns
    (uint256)
    {
        return MathLibrary.safeGetPartialAmountWithFloorRounding(numerator, denominator, target);
    }
}
