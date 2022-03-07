const MockOrderLibrary = artifacts.require("MockOrderLibrary.sol");
const order = require("./types/order");
const {expectThrow} = require("./utils/expect_throw");

//todo
contract("test OrderLibrary.sol", accounts => {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
    const ZERO_ASSET_CLASS = '0x00000000'
    const EMPTY_DATA = '0x'
    const ZERO_ORDER = order.Order(
        ZERO_ADDRESS,
        order.Asset(ZERO_ASSET_CLASS, EMPTY_DATA, 0),
        ZERO_ADDRESS,
        order.Asset(ZERO_ASSET_CLASS, EMPTY_DATA, 0),
        0,
        0,
        0,
        "0xffffffff",
        EMPTY_DATA)
    let mockOrderLibrary

    before(async () => {
        mockOrderLibrary = await MockOrderLibrary.new()
    });

    describe("test OrderLibrary.calculateRemainingValuesInOrder()", () => {
        it("should calculate remaining when fill is 0", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 100
            mockOrder.takeAsset.value = 200
            const res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 0, false)
            assert.equal(res[0], 100)
            assert.equal(res[1], 200)
        });

        it("should revert when fill > asset's values", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 100
            mockOrder.takeAsset.value = 200
            await expectThrow(
                mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 101, true)
            );
            await expectThrow(
                mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 201, false)
            );
        });

        it("should calculate remaining when fill isn't 0", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 100
            mockOrder.takeAsset.value = 200
            let res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 5, true)
            assert.equal(res[0], 100 - 5)
            assert.equal(res[1], 200 / 100 * (100 - 5))

            res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 50, false)
            assert.equal(res[0], 100 / 200 * (200 - 50))
            assert.equal(res[1], 200 - 50)
        });
    })
});