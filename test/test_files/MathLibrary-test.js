const MockMathLibrary = artifacts.require("MockMathLibrary.sol");
const {expectThrow} = require("./utils/expect_throw");
const ethUtil = require('ethereumjs-util');

contract('test MathLibrary.sol', accounts => {

    let mockMathLibrary

    before(async () => {
        mockMathLibrary = await MockMathLibrary.new()
    })

    it("should return right value: numerator(100) denominator(200) target(50)", async () => {
        const res = await mockMathLibrary.safeGetPartialAmountWithFloorRounding(100, 200, 50)
        assert.equal(res, 25)
    });

    it("should return 0 when target=0: numerator(100) denominator(200) target(0)", async () => {
        const res = await mockMathLibrary.safeGetPartialAmountWithFloorRounding(100, 200, 0)
        assert.equal(res, 0)
    });

    it("should return 0 when numerator=0: numerator(0) denominator(200) target(50)", async () => {
        const res = await mockMathLibrary.safeGetPartialAmountWithFloorRounding(100, 200, 0)
        assert.equal(res, 0)
    });

    it("should revert if denominator=0 : numerator(100) denominator(0) target(50)", async () => {
        await expectThrow(
            mockMathLibrary.safeGetPartialAmountWithFloorRounding(100, 0, 50),
            'zero divisor'
        )
    });

    it("should revert if overflow: numerator(type(uint).max) denominator(200) target(2)", async () => {
        await expectThrow(
            mockMathLibrary.safeGetPartialAmountWithFloorRounding(ethUtil.MAX_INTEGER / 2 + 1, 1, 2)
        )
    });

    it("should revert if relative error >= 1/1000", async () => {
        await expectThrow(
            // remainder: 1 * 2 % 3 == 2  and 2 / (1 * 2)  >  1 / 1000
            mockMathLibrary.safeGetPartialAmountWithFloorRounding(1, 3, 2),
            'bad floor rounding'
        )
    });
})
