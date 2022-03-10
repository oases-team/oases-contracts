const MockOrderLibrary = artifacts.require("MockOrderLibrary.sol");
const order = require("./types/order");
const {expectThrow} = require("./utils/expect_throw");
const {generateRandomAddress} = require("./utils/signature");
const {getRandomInteger} = require("./utils/random");
const {ERC20_CLASS, ERC721_CLASS} = require("./types/assets");

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
    })

    describe("test OrderLibrary.calculateRemainingValuesInOrder()", () => {
        it("should calculate remaining when fill is 0", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 1000
            mockOrder.takeAsset.value = 2000
            const res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 0, false)
            assert.equal(res[0], 1000)
            assert.equal(res[1], 2000)
        })

        it("should calculate remaining when fill isn't 0", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 1000
            mockOrder.takeAsset.value = 2000
            let res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 5, true)
            assert.equal(res[0], 1000 - 5)
            assert.equal(res[1], 2000 / 1000 * (1000 - 5))

            res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 50, false)
            assert.equal(res[0], 1000 / 2000 * (2000 - 50))
            assert.equal(res[1], 2000 - 50)
        })

        it("should revert when fill > asset's values", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 1000
            mockOrder.takeAsset.value = 2000
            await expectThrow(
                mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 1001, true)
            )
            await expectThrow(
                mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 2001, false)
            )
        })

        it("should return 0 if it's a full fill", async () => {
            let mockOrder = ZERO_ORDER
            mockOrder.makeAsset.value = 1000
            mockOrder.takeAsset.value = 2000

            let res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 1000, true)
            assert.equal(res[0], 0)
            assert.equal(res[1], 0)

            res = await mockOrderLibrary.calculateRemainingValuesInOrder(mockOrder, 2000, false)
            assert.equal(res[0], 0)
            assert.equal(res[1], 0)
        })
    })

    describe("test OrderLibrary.checkTimeValidity()", () => {
        it("should pass if zero timestamp is set", async () => {
            let mockOrder = ZERO_ORDER
            const now = getCurrentTimestamp()
            // double zero timestamp
            await mockOrderLibrary.checkTimeValidity(mockOrder)

            // only zero timestamp
            mockOrder.startTime = now - 1000
            await mockOrderLibrary.checkTimeValidity(mockOrder)

            mockOrder.startTime = 0
            mockOrder.endTime = now + 1000
            await mockOrderLibrary.checkTimeValidity(mockOrder)
        })

        it("should pass if two timestamps are correctly set", async () => {
            let mockOrder = ZERO_ORDER
            const now = getCurrentTimestamp()
            mockOrder.startTime = now - 1000
            mockOrder.endTime = now + 1000
            await mockOrderLibrary.checkTimeValidity(mockOrder)
        })

        it("should revert if start timestamp is incorrectly set", async () => {
            let mockOrder = ZERO_ORDER
            const now = getCurrentTimestamp()
            mockOrder.startTime = now + 100
            mockOrder.endTime = now + 1000
            await expectThrow(
                mockOrderLibrary.checkTimeValidity(mockOrder),
                "Order start validation failed"
            )
        })

        it("should revert if end timestamp is incorrectly set", async () => {
            let mockOrder = ZERO_ORDER
            const now = getCurrentTimestamp()
            mockOrder.startTime = now - 1000
            mockOrder.endTime = now - 100
            await expectThrow(
                mockOrderLibrary.checkTimeValidity(mockOrder),
                "Order end validation failed"
            )
        })

        it("should revert if both timestamps are incorrectly set", async () => {
            let mockOrder = ZERO_ORDER
            const now = getCurrentTimestamp()
            mockOrder.startTime = now + 1
            mockOrder.endTime = now
            await expectThrow(
                mockOrderLibrary.checkTimeValidity(mockOrder),
                "Order start validation failed"
            )
        })

        describe("test OrderLibrary.getHashKey()", () => {
            it("should get hash key for a specific order", async () => {
                let mockOrder = ZERO_ORDER
                mockOrder.maker = generateRandomAddress()
                mockOrder.taker = generateRandomAddress()
                mockOrder.makeAsset.assetType.assetClass = ERC721_CLASS
                mockOrder.takeAsset.assetType.assetClass = ERC20_CLASS
                mockOrder.makeAsset.value = getRandomInteger(0, 102410241024)
                mockOrder.takeAsset.value = getRandomInteger(0, 102410241024)
                const now = getCurrentTimestamp()
                mockOrder.startTime = now - 100
                mockOrder.endTime = now - 100
                mockOrder.salt = 1

                const mockHashKey = await mockOrderLibrary.mockGetHashKey(mockOrder)
                const hashKey = await mockOrderLibrary.getHashKey(mockOrder)
                assert.equal(hashKey, mockHashKey)
            })
        })

        describe("test OrderLibrary.getHash()", () => {
            it("should get hash for a specific order", async () => {
                let mockOrder = ZERO_ORDER
                mockOrder.maker = generateRandomAddress()
                mockOrder.taker = generateRandomAddress()
                mockOrder.makeAsset.assetType.assetClass = ERC721_CLASS
                mockOrder.takeAsset.assetType.assetClass = ERC20_CLASS
                mockOrder.makeAsset.value = getRandomInteger(0, 102410241024)
                mockOrder.takeAsset.value = getRandomInteger(0, 102410241024)
                const now = getCurrentTimestamp()
                mockOrder.startTime = now - 100
                mockOrder.endTime = now - 100
                mockOrder.salt = 1

                const mockHash = await mockOrderLibrary.mockGetHash(mockOrder)
                const hash = await mockOrderLibrary.getHash(mockOrder)
                assert.equal(hash, mockHash)
            })
        })
    })
});

function getCurrentTimestamp() {
    return parseInt(new Date() / 1000);
}