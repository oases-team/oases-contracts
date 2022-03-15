const MockOFillLibrary = artifacts.require("MockFillLibrary.sol");
const order = require("./types/order");
const {expectThrow} = require("./utils/expect_throw");

contract("test FillLibrary.sol", accounts => {
    let mockFillLibrary

    before(async () => {
        mockFillLibrary = await MockOFillLibrary.new()
    })

    describe("right order fill", () => {
        it("should fill fully right order if the prices are the same", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(140, 70)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 70);
            assert.equal(fillResult[1], 140);
        });

        it("should revert if right order is fully matched with a lower price", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(139, 70)

            await expectThrow(
                mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false),
                "bad fill when right order or both sides should be filled fully"
            )
        });

        it("should fill fully right order with a higher price", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(210, 70)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 70);
            assert.equal(fillResult[1], 140);
        })
    })

    describe("left order fill", () => {
        it("should fill fully left order if the prices are the same", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(6000, 3000)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 1000);
            assert.equal(fillResult[1], 2000);
        });

        it("should revert if left order's price is higher than the right order's", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(5994, 3000)

            await expectThrow(
                mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false),
                "bad fill when left order should be filled fully"
            )
        });

        it("should fill fully left order if right order has a higher price", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(5000, 2000)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 1000);
            assert.equal(fillResult[1], 2000);
        })
    })

    describe("both orders' fill", () => {
        it("should fill fully both orders if the prices are the same", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(2000, 1000)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 1000);
            assert.equal(fillResult[1], 2000);
        });

        it("should fill fully both orders if right order has a higher price", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(2010, 1000)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 1000);
            assert.equal(fillResult[1], 2000);
        });

        it("should fill both orders if right order has a higher price and less amount based on the left order's price", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(2010, 999)

            const fillResult = await mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false);
            assert.equal(fillResult[0], 999);
            assert.equal(fillResult[1], 1998);
        })

        it("should revert if left order's price is higher than the right order's", async () => {
            const leftOrder = getOrderWithAmount(1000, 2000)
            const rightOrder = getOrderWithAmount(1999, 1000)

            await expectThrow(
                mockFillLibrary.fillOrders(leftOrder, rightOrder, 0, 0, false, false),
                "bad fill when right order or both sides should be filled fully"
            )
        });
    })
})

function getOrderWithAmount(makeAssetValue, takeAssetValue) {
    let mockOrder = order.getZeroOrder()
    mockOrder.makeAsset.value = makeAssetValue
    mockOrder.takeAsset.value = takeAssetValue
    return mockOrder
}

