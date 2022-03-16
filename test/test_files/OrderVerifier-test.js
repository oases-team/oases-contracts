const MockOrderVerifier = artifacts.require("MockOrderVerifier.sol")
const MockERC1271 = artifacts.require("MockERC1271.sol")
const order = require("./types/order")
const sign = order.sign;
const {getCurrentTimestamp} = require("./utils/utils");
const {generateRandomAddress} = require("./utils/signature");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const {expectThrow} = require("./utils/expect_throw");

contract("test OrderVerifier.sol", accounts => {
    const now = getCurrentTimestamp()
    let mockOrderVerifier;
    let erc1271;
    // let erc20;

    beforeEach(async () => {
        mockOrderVerifier = await MockOrderVerifier.new();
        await mockOrderVerifier.__MockOrderVerifier_init();
        erc1271 = await MockERC1271.new();
        // erc20 = await TestERC1271.new();
    });

    it("should pass if signer is correct", async () => {
        const mockOrder =
            order.Order(
                accounts[0],
                order.Asset("0x12345678", "0x1234567890abcdef", 1024),
                generateRandomAddress(),
                order.Asset("0x87654321", "0xfedcba0987654321", 2048),
                1,
                now,
                now + 1000,
                "0x12345678",
                "0x1234567890abcdef"
            );
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        await mockOrderVerifier.mockVerifyOrder(mockOrder, signature, {from: accounts[1]})
    })

    it("should revert if the order is changed", async () => {
        const mockOrder =
            order.Order(
                accounts[0],
                order.Asset("0x12345678", "0x1234567890abcdef", 1024),
                generateRandomAddress(),
                order.Asset("0x87654321", "0xfedcba0987654321", 2048),
                1,
                now,
                now + 1000,
                "0x12345678",
                "0x1234567890abcdef"
            );
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        mockOrder.salt += 1
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, signature, {from: accounts[1]}),
            "bad order signature verification"
        )
    })
})
