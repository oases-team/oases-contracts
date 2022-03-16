const MockOrderVerifier = artifacts.require("MockOrderVerifier.sol")
const MockERC1271 = artifacts.require("MockERC1271.sol")
const order = require("./types/order")
const {getCurrentTimestamp} = require("./utils/utils");
const {generateRandomAddress} = require("./utils/signature");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const {expectThrow} = require("./utils/expect_throw");

contract("test OrderVerifier.sol", accounts => {
    const now = getCurrentTimestamp()
    let mockOrderVerifier;
    let erc1271;

    beforeEach(async () => {
        mockOrderVerifier = await MockOrderVerifier.new();
        await mockOrderVerifier.__MockOrderVerifier_init();
        erc1271 = await MockERC1271.new();
    });

    it("should pass if signer is correct", async () => {
        const mockOrder = getMockOrder(accounts[0])
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        await mockOrderVerifier.mockVerifyOrder(mockOrder, signature, {from: accounts[1]})
    })

    it("should revert if the order is changed", async () => {
        const mockOrder = getMockOrder(accounts[0])
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        mockOrder.salt += 1
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, signature, {from: accounts[1]}),
            "bad order signature verification"
        )
    })

    it("should revert if signer is incorrect", async () => {
        const mockOrder = getMockOrder(accounts[0])
        const signature = await order.sign(mockOrder, accounts[1], mockOrderVerifier.address)
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, signature, {from: accounts[2]}),
            "bad order signature verification"
        );
    });

    it("should pass if maker is msg.sender", async () => {
        const mockOrder = getMockOrder(accounts[0])
        await mockOrderVerifier.mockVerifyOrder(mockOrder, "0x")
    });

    it("should pass if signer is contract with ERC1271 pass", async () => {
        const mockOrder = getMockOrder(erc1271.address)
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, signature),
            "bad signature verification for contract"
        )

        await erc1271.setReturnSuccessfulValidSignature(true)
        await mockOrderVerifier.mockVerifyOrder(mockOrder, signature)
    });

    it("should revert if the contract don't support ERC1271_INTERFACE", async () => {
        const mockOrder = getMockOrder(mockOrderVerifier.address)
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, signature),
            "VM Exception while processing transaction: revert"
        );
    });

    it("should pass if signer is contract with ERC1271 pass and empty signature", async () => {
        const mockOrder = getMockOrder(erc1271.address)
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, '0x'),
            "bad signature verification for contract"
        )

        await erc1271.setReturnSuccessfulValidSignature(true)
        await mockOrderVerifier.mockVerifyOrder(mockOrder, '0x')
    })

    it("should pass if order salt is 0 and order maker matched msg.sender", async () => {
        const mockOrder = getMockOrder(accounts[1])
        mockOrder.salt = 0
        await mockOrderVerifier.mockVerifyOrder(mockOrder, '0x', {from: accounts[1]})
    })

    it("should revert if order salt is 0 && order maker unmatched msg.sender && right signature", async () => {
        const mockOrder = getMockOrder(accounts[0])
        mockOrder.salt = 0
        const signature = await order.sign(mockOrder, accounts[0], mockOrderVerifier.address)
        await expectThrow(
            mockOrderVerifier.mockVerifyOrder(mockOrder, signature, {from: accounts[1]}),
            "maker is not tx sender"
        )
    })

    it("should pass if order salt is 0 && zero order maker && empty signature", async () => {
        const mockOrder = getMockOrder(ZERO_ADDRESS)
        mockOrder.salt = 0
        await mockOrderVerifier.mockVerifyOrder(mockOrder, '0x', {from: accounts[1]})
    })

    function getMockOrder(maker) {
        return order.Order(
            maker,
            order.Asset("0x12345678", "0x1234567890abcdef", 1024),
            generateRandomAddress(),
            order.Asset("0x87654321", "0xfedcba0987654321", 2048),
            1,
            now,
            now + 1000,
            "0x12345678",
            "0x1234567890abcdef"
        )
    }
})
