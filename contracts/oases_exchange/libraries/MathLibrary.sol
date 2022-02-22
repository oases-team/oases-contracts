// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

library MathLibrary {

    // @dev Calculates partial value given a numerator and denominator rounded down.
    //      Reverts if rounding error is >= 0.1%
    // @param numerator Numerator.
    // @param denominator Denominator.
    // @param target value to calculate partial of.
    // @return partial amount value of target rounded down.
    function safeGetPartialAmountWithFloorRounding(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    )
    internal
    pure
    returns
    (uint256)
    {
        require(
            !isFloorRoundingError(numerator, denominator, target),
            "bad floor rounding"
        );

        return numerator * target / denominator;
    }

    function isFloorRoundingError(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    )
    internal
    pure
    returns
    (bool)
    {
        require(denominator != 0, "zero divisor");

        // The absolute rounding error is the difference between the rounded
        // value and the ideal value. The relative rounding error is the
        // absolute rounding error divided by the absolute value of the
        // ideal value. This is undefined when the ideal value is zero.
        //
        // The ideal value is `numerator * target / denominator`.
        // Let's call `numerator * target % denominator` the remainder.
        // The absolute error is `remainder / denominator`.
        //
        // When the ideal value is zero, we require the absolute error to
        // be zero. Fortunately, this is always the case. The ideal value is
        // zero iff `numerator == 0` and/or `target == 0`. In this case the
        // remainder and absolute error are also zero.
        if (target == 0 || numerator == 0) {
            return false;
        }

        // Otherwise, we want the relative rounding error to be strictly
        // less than 0.1%.
        // The relative error is `remainder / (numerator * target)`.
        // We want the relative error less than 1 / 1000:
        //        remainder / (numerator * target)  <  1 / 1000
        // or equivalently:
        //        1000 * remainder  <  numerator * target
        // so we have a rounding error if:
        //        1000 * remainder  >=  numerator * target
        uint256 remainder = mulmod(target, numerator, denominator);
        return remainder * 1000 >= numerator * target;
    }
}
