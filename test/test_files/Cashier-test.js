const MockCashier = artifacts.require("MockCashier.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockBadERC721 = artifacts.require("MockBadERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const order = require("./types/order");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const {verifyBalanceChange, expectThrow} = require("./utils/expect_throw")
const {encode, ETH_CLASS, ERC20_CLASS, ERC721_CLASS, ERC1155_CLASS} = require("./types/assets")

contract("test Cashier.sol", accounts => {
    let mockCashier
    let mockERC20
    let mockERC721
    let mockBadERC721
    let mockERC1155
    let mockNFTTransferProxy
    let mockERC20TransferProxy

    beforeEach(async () => {
        mockERC20 = await MockERC20.new()
        mockERC721 = await MockERC721.new()
        mockBadERC721 = await MockBadERC721.new()
        mockERC1155 = await MockERC1155.new()
        mockNFTTransferProxy = await MockNFTTransferProxy.new()
        mockERC20TransferProxy = await MockERC20TransferProxy.new()
        mockCashier = await MockCashier.new()
        await mockCashier.__MockCashier_init(mockERC20TransferProxy.address, mockNFTTransferProxy.address)
    })

    it("should transfer ETH successfully", async () => {
        await verifyBalanceChange(accounts[0], 1024, () =>
            verifyBalanceChange(accounts[1], -1024, () =>
                mockCashier.transfer(order.Asset(ETH_CLASS, "0x", 1024), ZERO_ADDRESS, accounts[1], {
                    value: 1024,
                    gasPrice: "0"
                })
            )
        )
    })

    it("should transfer ERC20 successfully", async () => {
        await mockERC20.mint(accounts[0], 1024);
        await mockERC20.approve(mockERC20TransferProxy.address, 1024, {from: accounts[0]});
        await mockCashier.transfer(order.Asset(ERC20_CLASS, encode(mockERC20.address), 1000), accounts[0], accounts[1])

        assert.equal(await mockERC20.balanceOf(accounts[0]), 24);
        assert.equal(await mockERC20.balanceOf(accounts[1]), 1000);
    })

    it("should transfer ERC721 successfully", async () => {
        await mockERC721.mint(accounts[1], 1);
        await mockERC721.approve(mockNFTTransferProxy.address, 1, {from: accounts[1]});
        await expectThrow(
            mockCashier.transfer(order.Asset(ERC721_CLASS, encode(mockERC721.address, 1), 2), accounts[1], accounts[2]),
            "ERC721's strict amount"
        )

        await mockCashier.transfer(order.Asset(ERC721_CLASS, encode(mockERC721.address, 1), 1), accounts[1], accounts[2])
        assert.equal(await mockERC721.ownerOf(1), accounts[2]);
        assert.equal(await mockERC721.balanceOf(accounts[1]), 0);
    })

    it("should transfer ERC1155 successfully", async () => {
        await mockERC1155.mint(accounts[1], 1, 1024);
        await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]});
        await mockCashier.transfer(order.Asset(ERC1155_CLASS, encode(mockERC1155.address, 1), 1000), accounts[1], accounts[2])
        assert.equal(await mockERC1155.balanceOf(accounts[1], 1), 24);
        assert.equal(await mockERC1155.balanceOf(accounts[2], 1), 1000);
    })
})