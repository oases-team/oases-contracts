const MockOasesCashierManager = artifacts.require("MockOasesCashierManager.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const MockRoyaltiesRegistry = artifacts.require("MockRoyaltiesRegistry.sol")

const {getRandomInteger} = require("./utils/utils")
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")
const {AssetType, Asset, Order, sign, getZeroOrder, ZERO_ASSET_CLASS, EMPTY_DATA} = require("./types/order")
const {encode, ETH_CLASS, ERC20_CLASS, ERC721_CLASS, ERC1155_CLASS} = require("./types/assets")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_FLAG_ADDRESS = ZERO_ADDRESS

contract("test OasesCashierManager.sol", accounts => {
    let mockOasesCashierManager
    let mockERC20_1
    let mockERC20_2
    let mockERC721
    let mockERC1155
    let mockNFTTransferProxy
    let mockERC20TransferProxy
    let mockRoyaltiesRegistry
    let defaultFeeReceiver = accounts[9]
    let protocolFeeReceiver = accounts[8]
    let erc721TokenId_1 = getRandomInteger(0, 10000)
    let erc1155TokenId_1 = getRandomInteger(0, 10000)

    function encodeData(object) {
        return mockOasesCashierManager.encodeData(object)
    }

    beforeEach(async () => {
        mockNFTTransferProxy = await MockNFTTransferProxy.new()
        mockERC20TransferProxy = await MockERC20TransferProxy.new()
        mockOasesCashierManager = await MockOasesCashierManager.new()
        mockRoyaltiesRegistry = await MockRoyaltiesRegistry.new()
        await mockOasesCashierManager.__MockOasesCashierManager_init(
            mockERC20TransferProxy.address,
            mockNFTTransferProxy.address,
            300,
            defaultFeeReceiver,
            mockRoyaltiesRegistry.address
        );
        // ERC20
        mockERC20_1 = await MockERC20.new()
        // mockERC20_2 = await MockERC20.new();
        // ERC721
        mockERC721 = await MockERC721.new("MockERC721", "M721", "https://erc721mock.com")
        // ERC1155
        mockERC1155 = await MockERC1155.new("https://erc1155mock.com")
        // await testing.setFeeReceiver(mockERC20_1.address, protocol);//
        /*ETH*/
        await mockOasesCashierManager.setFeeReceiver(ETH_FLAG_ADDRESS, protocolFeeReceiver)
        // /*NFT 721 RoyalitiesV1*/
        // erc721V1 = await ERC721_V1.new("Rarible", "RARI", "https://ipfs.rarible.com");
        // await erc721V1.initialize();
        // /*NFT 721 RoyalitiesV2*/
        // erc721V2 = await ERC721_V2.new("Rarible", "RARI", "https://ipfs.rarible.com");
        // await erc721V2.initialize();
        // /*1155 RoyalitiesV1*/
        // erc1155V1 = await ERC1155_V1.new("https://ipfs.rarible.com");
        // await erc1155V1.initialize();
        // /*1155 RoyalitiesV2*/
        // erc1155V2 = await ERC1155_V2.new("https://ipfs.rarible.com");
        // await erc1155V2.initialize();
        // /*NFT 721 RoyalitiesV1 with interface error*/
        // erc721V1_Error = await ERC721_V1_Error.new("Rarible", "RARI", "https://ipfs.rarible.com");
        // /*NFT 1155 RoyalitiesV2 with interface error*/
        // erc1155V2_Error = await ERC1155_V2_Error.new("https://ipfs.rarible.com");
    })

    describe("test allocateAssets()", () => {
        it("Transfer from ETH to ERC1155, protocol fee 6% (buyerFee 3%, sellerFee 3%)", async () => {
            const {leftOrder, rightOrder} = await genETH_1155Orders(10)

            await verifyBalanceChange(accounts[0], 103, () =>
                verifyBalanceChange(accounts[2], -97, () =>
                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                        mockOasesCashierManager.mockAllocateAssets(
                            [100, 7],
                            leftOrder.makeAsset.assetType,
                            leftOrder.takeAsset.assetType,
                            leftOrder,
                            rightOrder,
                            {value: 103, from: accounts[0], gasPrice: 0}
                        )
                    )
                )
            )
            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 7);
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 3);
        })

        async function genETH_1155Orders(amountERC1155 = 10) {
            await mockERC1155.mint(accounts[1], erc1155TokenId_1, amountERC1155)
            await mockERC1155.setApprovalForAll(
                mockNFTTransferProxy.address,
                true,
                {from: accounts[1]}
            )

            const leftOrder = Order(
                accounts[0],
                Asset(ETH_CLASS, "0x", 100),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            );
            return {leftOrder, rightOrder}
        }

        // it("Transfer from ERC721 to ERC721", async () => {
        //     const {left, right} = await prepare721_721Orders()
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 1], left, right);
        //
        //     assert.equal(await erc721.ownerOf(erc721TokenId1), accounts[2]);
        //     assert.equal(await erc721.ownerOf(erc721TokenId0), accounts[1]);
        // })
        //
        // async function prepare721_721Orders() {
        //     await erc721.mint(accounts[1], erc721TokenId1);
        //     await erc721.mint(accounts[2], erc721TokenId0);
        //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
        //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
        //     let data = await encDataV1([[], []]);
        //     const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId0), 1), 1, 0, 0, ORDER_DATA_V1, data);
        //     const right = Order(accounts[2], Asset(ERC721, enc(erc721.address, erc721TokenId0), 1), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, data);
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC721 to ERC1155, (buyerFee3%, sallerFee3% = 6%) of ERC1155 transfer to community, orders dataType == V1", async () => {
        //     const {left, right} = await prepare721_1155Orders(110)
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 100], left, right);
        //
        //     assert.equal(await erc721.balanceOf(accounts[1]), 0);
        //     assert.equal(await erc721.balanceOf(accounts[2]), 1);
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 93);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 1);
        //     assert.equal(await erc1155.balanceOf(community, erc1155TokenId1), 6);
        // })
        //
        // async function prepare721_1155Orders(t2Amount = 105) {
        //     await erc721.mint(accounts[1], erc721TokenId1);
        //     await erc1155.mint(accounts[2], erc1155TokenId1, t2Amount);
        //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
        //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
        //     /*in this: accounts[3] - address originLeftOrder, 100 - originLeftOrderFee(bp%)*/
        //     let addrOriginLeft = [[accounts[3], 100], [accounts[5], 300]];
        //     let addrOriginRight = [[accounts[4], 200], [accounts[6], 400]];
        //     let encDataLeft = await encDataV1([[[accounts[1], 10000]], addrOriginLeft]);
        //     let encDataRight = await encDataV1([[[accounts[2], 10000]], addrOriginRight]);
        //     const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
        //     const right = Order(accounts[2], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataRight);
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC1155 to ERC1155: 2 to 10, 50% 50% for payouts", async () => {
        //     const {left, right} = await prepare1155_1155Orders();
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [2, 10], left, right);
        //
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 98);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 0);
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId2), 0);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId2), 90);
        //
        //     assert.equal(await erc1155.balanceOf(accounts[3], erc1155TokenId2), 5);
        //     assert.equal(await erc1155.balanceOf(accounts[5], erc1155TokenId2), 5);
        //     assert.equal(await erc1155.balanceOf(accounts[4], erc1155TokenId1), 1);
        //     assert.equal(await erc1155.balanceOf(accounts[6], erc1155TokenId1), 1);
        // });
        //
        // async function prepare1155_1155Orders() {
        //     await erc1155.mint(accounts[1], erc1155TokenId1, 100);
        //     await erc1155.mint(accounts[2], erc1155TokenId2, 100);
        //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
        //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
        //     let encDataLeft = await encDataV1([[[accounts[3], 5000], [accounts[5], 5000]], []]);
        //     let encDataRight = await encDataV1([[[accounts[4], 5000], [accounts[6], 5000]], []]);
        //     const left = Order(accounts[1], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 2), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 10), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
        //     const right = Order(accounts[2], Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 10), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 2), 1, 0, 0, ORDER_DATA_V1, encDataRight);
        //     return {left, right}
        // }
        //
        // it("rounding error Transfer from ERC1155 to ERC1155: 1 to 5, 50% 50% for payouts", async () => {
        //     const {left, right} = await prepare1155_1155Orders();
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 5], left, right);
        //
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 99);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 0);
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId2), 0);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId2), 95);
        //
        //     assert.equal(await erc1155.balanceOf(accounts[3], erc1155TokenId2), 2);
        //     assert.equal(await erc1155.balanceOf(accounts[5], erc1155TokenId2), 3);
        //     assert.equal(await erc1155.balanceOf(accounts[4], erc1155TokenId1), 0);
        //     assert.equal(await erc1155.balanceOf(accounts[6], erc1155TokenId1), 1);
        //     assert.equal(await erc1155.balanceOf(community, erc1155TokenId1), 0);
        // });
        //
        // it("Transfer from ERC1155 to ERC721, (buyerFee3%, sallerFee3% = 6%) of ERC1155 protocol (buyerFee3%, sallerFee3%)", async () => {
        //     const {left, right} = await prepare1155O_721rders(105)
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 1], left, right);
        //
        //     assert.equal(await erc721.balanceOf(accounts[2]), 0);
        //     assert.equal(await erc721.balanceOf(accounts[1]), 1);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 97);
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 2);
        //     assert.equal(await erc1155.balanceOf(protocol, erc1155TokenId1), 6);
        // })
        //
        // async function prepare1155O_721rders(t2Amount = 105) {
        //     await erc1155.mint(accounts[1], erc1155TokenId1, t2Amount);
        //     await erc721.mint(accounts[2], erc721TokenId1);
        //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
        //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
        //     await testing.setFeeReceiver(erc1155.address, protocol);
        //     const left = Order(accounts[1], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, "0xffffffff", "0x");
        //     const right = Order(accounts[2], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), 1, 0, 0, "0xffffffff", "0x");
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC20 to ERC1155, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
        //     const {left, right} = await prepare20_1155Orders(105, 10)
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 7], left, right);
        //
        //     assert.equal(await t1.balanceOf(accounts[1]), 2);
        //     assert.equal(await t1.balanceOf(accounts[2]), 97);
        //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 7);
        //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 3);
        //     assert.equal(await t1.balanceOf(protocol), 6);
        // })
        //
        // async function prepare20_1155Orders(t1Amount = 105, t2Amount = 10) {
        //     await t1.mint(accounts[1], t1Amount);
        //     await erc1155.mint(accounts[2], erc1155TokenId1, t2Amount);
        //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[1]});
        //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
        //
        //     const left = Order(accounts[1], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 7), 1, 0, 0, "0xffffffff", "0x");
        //     const right = Order(accounts[2], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 7), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC1155 to ERC20, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
        //     const {left, right} = await prepare1155_20Orders(10, 105)
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [7, 100], left, right);
        //
        //     assert.equal(await t1.balanceOf(accounts[3]), 97);
        //     assert.equal(await t1.balanceOf(accounts[4]), 2);
        //     assert.equal(await erc1155.balanceOf(accounts[3], erc1155TokenId2), 3);
        //     assert.equal(await erc1155.balanceOf(accounts[4], erc1155TokenId2), 7);
        //     assert.equal(await t1.balanceOf(protocol), 6);
        // })
        //
        // async function prepare1155_20Orders(t1Amount = 10, t2Amount = 105) {
        //     await erc1155.mint(accounts[3], erc1155TokenId2, t1Amount);
        //     await t1.mint(accounts[4], t2Amount);
        //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[3]});
        //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[4]});
        //
        //     const left = Order(accounts[3], Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 7), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
        //     const right = Order(accounts[4], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 7), 1, 0, 0, "0xffffffff", "0x");
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC20 to ERC721, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
        //     const {left, right} = await prepare20_721Orders()
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 1], left, right);
        //
        //     assert.equal(await t1.balanceOf(accounts[1]), 2);
        //     assert.equal(await t1.balanceOf(accounts[2]), 97);
        //     assert.equal(await erc721.balanceOf(accounts[1]), 1);
        //     assert.equal(await erc721.balanceOf(accounts[2]), 0);
        //     assert.equal(await t1.balanceOf(protocol), 6);
        // })
        //
        // async function prepare20_721Orders(t1Amount = 105) {
        //     await t1.mint(accounts[1], t1Amount);
        //     await erc721.mint(accounts[2], erc721TokenId1);
        //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[1]});
        //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
        //
        //     const left = Order(accounts[1], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, "0xffffffff", "0x");
        //     const right = Order(accounts[2], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC721 to ERC20, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
        //     const {left, right} = await prepare721_20Orders()
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 100], left, right);
        //
        //     assert.equal(await t1.balanceOf(accounts[1]), 97);
        //     assert.equal(await t1.balanceOf(accounts[2]), 2);
        //     assert.equal(await erc721.balanceOf(accounts[1]), 0);
        //     assert.equal(await erc721.balanceOf(accounts[2]), 1);
        //     assert.equal(await t1.balanceOf(protocol), 6);
        // })
        //
        // async function prepare721_20Orders(t1Amount = 105) {
        //     await erc721.mint(accounts[1], erc721TokenId1);
        //     await t1.mint(accounts[2], t1Amount);
        //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
        //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[2]});
        //
        //     const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
        //     const right = Order(accounts[2], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, "0xffffffff", "0x");
        //     return {left, right}
        // }
        //
        // it("Transfer from ERC20 to ERC20, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
        //     const {left, right} = await prepare2Orders()
        //
        //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 200], left, right);
        //
        //     assert.equal(await t1.balanceOf(accounts[1]), 2);
        //     assert.equal(await t1.balanceOf(accounts[2]), 97);
        //     assert.equal(await t2.balanceOf(accounts[1]), 200);
        //     assert.equal(await t2.balanceOf(accounts[2]), 20);
        //     assert.equal(await t1.balanceOf(protocol), 6);
        // })
        //
        // async function prepare2Orders(t1Amount = 105, t2Amount = 220) {
        //     await t1.mint(accounts[1], t1Amount);
        //     await t2.mint(accounts[2], t2Amount);
        //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[1]});
        //     await t2.approve(erc20TransferProxy.address, 10000000, {from: accounts[2]});
        //
        //     const left = Order(accounts[1], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC20, enc(t2.address), 200), 1, 0, 0, "0xffffffff", "0x");
        //     const right = Order(accounts[2], Asset(ERC20, enc(t2.address), 200), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
        //     return {left, right}
        // }
    })

})