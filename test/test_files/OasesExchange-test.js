const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades')
const OasesExchange = artifacts.require("OasesExchange.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const MockRoyaltiesRegistry = artifacts.require("MockRoyaltiesRegistry.sol")
const MockOasesCashierManager = artifacts.require("MockOasesCashierManager.sol")
const MockOrderLibrary = artifacts.require("MockOrderLibrary.sol")
// const LibOrderTest = artifacts.require("LibOrderTest.sol");
// const RaribleTransferManagerTest = artifacts.require("RaribleTransferManagerTest.sol");
// const truffleAssert = require('truffle-assertions');
// const TestRoyaltiesRegistry = artifacts.require("TestRoyaltiesRegistry.sol");
// const TestERC721RoyaltyV1OwnUpgrd = artifacts.require("TestERC721WithRoyaltiesV1OwnableUpgradeable");
// const AssetMatcherCollectionTest = artifacts.require("AssetMatcherCollectionTest.sol");
const eip712 = require("./utils/eip712")
const {Order, Asset, sign, EMPTY_DATA, EMPTY_BYTES4, ORDER_V1_DATA_TYPE} = require("./types/order")
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_FLAG_ADDRESS = ZERO_ADDRESS
const {
    COLLECTION,
    encode,
    calculateBytes4InContract,
    ETH_CLASS,
    ERC20_CLASS,
    ERC721_CLASS,
    ERC1155_CLASS,
    TO_MAKER,
    TO_TAKER,
    PROTOCOL,
    ROYALTY,
    ORIGIN,
    PAYOUT,
    CRYPTO_PUNKS,
} = require("./types/assets")
const {getRandomInteger} = require('./utils/utils')

contract("test OasesExchange.sol (protocol fee 3% —— seller + buyer = 6%)", accounts => {
    const protocolFeeReceiver = accounts[9]
    const communityAddress = accounts[8]
    const erc721TokenId_1 = getRandomInteger(0, 10000)
    const erc721TokenId_2 = erc721TokenId_1 + 1
    const erc1155TokenId_1 = getRandomInteger(0, 10000)
    const erc1155TokenId_2 = erc1155TokenId_1 + 1

    let oasesExchange
    let mockOasesCashierManager
    let mockERC20_1
    let mockERC20_2
    let mockERC721
    let mockERC1155
    let mockNFTTransferProxy
    let mockERC20TransferProxy
    let mockOrderLibrary
    let mockRoyaltiesRegistry
//     let protocol = accounts[9];
//     let community = accounts[8];
//     const eth = "0x0000000000000000000000000000000000000000";
//     let erc721TokenId0 = 52;
//     let erc721TokenId1 = 53;
//     let erc1155TokenId1 = 54;
//     let erc1155TokenId2 = 55;
//     let royaltiesRegistry;
//
    beforeEach(async () => {
        mockNFTTransferProxy = await MockNFTTransferProxy.new()
        mockERC20TransferProxy = await MockERC20TransferProxy.new()
        mockRoyaltiesRegistry = await MockRoyaltiesRegistry.new()
        oasesExchange = await deployProxy(
            OasesExchange,
            [
                300,
                communityAddress,
                mockRoyaltiesRegistry.address,
                mockERC20TransferProxy.address,
                mockNFTTransferProxy.address
            ],
            {
                initializer: "__OasesExchange_init"
            }
        )
        // utils
        mockOasesCashierManager = await MockOasesCashierManager.new()
        mockOrderLibrary = await MockOrderLibrary.new()

        // ERC20
        mockERC20_1 = await MockERC20.new()
        mockERC20_2 = await MockERC20.new()
        // ERC721
        mockERC721 = await MockERC721.new()
        // ERC1155
        mockERC1155 = await MockERC1155.new()
        await oasesExchange.setFeeReceiver(ETH_FLAG_ADDRESS, protocolFeeReceiver)
    })

    // describe("test matchOrders()", () => {
    //     it("eth orders work. revert when eth is not enough", async () => {
    //         await mockERC20_1.mint(accounts[1], 10000)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 10000, {from: accounts[1]})
    //
    //         const leftOrder = Order(
    //             accounts[2],
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             ZERO_ADDRESS,
    //             Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA
    //         )
    //
    //         const rightOrder = Order(
    //             accounts[1],
    //             Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
    //             ZERO_ADDRESS,
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA)
    //
    //         await expectThrow(
    //             oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrder,
    //                 EMPTY_DATA,
    //                 await getSignature(rightOrder, accounts[1]),
    //                 {
    //                     from: accounts[2],
    //                     value: 199
    //                 }),
    //             "bad eth transfer"
    //         )
    //     })
    //
    //     it("eth orders work. revert with unknown data type of order", async () => {
    //         await mockERC20_1.mint(accounts[1], 100)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 10000, {from: accounts[1]})
    //
    //         const leftOrder = Order(
    //             accounts[2],
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             ZERO_ADDRESS,
    //             Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA
    //         )
    //
    //         const rightOrder = Order(
    //             accounts[1],
    //             Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
    //             ZERO_ADDRESS,
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             1,
    //             0,
    //             0,
    //             "0xfffffffe",
    //             EMPTY_DATA
    //         )
    //
    //         await expectThrow(
    //             oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrder,
    //                 EMPTY_DATA,
    //                 await getSignature(rightOrder, accounts[1]),
    //                 {
    //                     from: accounts[2],
    //                     value: 300
    //                 }),
    //             "unsupported order data type"
    //         )
    //     })
    //
    //     it("eth orders work. rest is returned to taker (other side)", async () => {
    //         await mockERC20_1.mint(accounts[1], 100)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 100, {from: accounts[1]})
    //
    //         const leftOrder = Order(
    //             accounts[2],
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             ZERO_ADDRESS,
    //             Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA)
    //
    //         const rightOrder = Order(
    //             accounts[1],
    //             Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
    //             ZERO_ADDRESS,
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA)
    //
    //         const signatureRight = await getSignature(rightOrder, accounts[1])
    //         await verifyBalanceChange(accounts[2], 206, async () =>
    //             verifyBalanceChange(accounts[1], -194, async () =>
    //                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                     oasesExchange.matchOrders(
    //                         leftOrder,
    //                         rightOrder,
    //                         EMPTY_DATA,
    //                         signatureRight,
    //                         {
    //                             from: accounts[2],
    //                             value: 300,
    //                             gasPrice: 0
    //                         })
    //                 )
    //             )
    //         )
    //
    //         assert.equal(await mockERC20_1.balanceOf(accounts[1]), 0)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[2]), 100)
    //     })
    //
    //     it("erc721 to eth order maker eth != who pay, both orders have to be with signatures", async () => {
    //         await mockERC721.mint(accounts[1], erc721TokenId_1)
    //         await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //         const leftOrder = Order(
    //             accounts[1],
    //             Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //             ZERO_ADDRESS,
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA
    //         )
    //         const rightOrder = Order(
    //             accounts[2],
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             ZERO_ADDRESS,
    //             Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA
    //         )
    //
    //         let signatureLeft = await getSignature(leftOrder, accounts[1])
    //         let signatureRight = await getSignature(rightOrder, accounts[2])
    //         await verifyBalanceChange(accounts[3], 206, async () =>
    //             verifyBalanceChange(accounts[1], -194, async () =>
    //                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                     // NB! from: accounts[3] - who pay for NFT != order Maker
    //                     oasesExchange.matchOrders(
    //                         leftOrder,
    //                         rightOrder,
    //                         signatureLeft,
    //                         signatureRight,
    //                         {
    //                             from: accounts[3],
    //                             value: 300,
    //                             gasPrice: 0
    //                         })
    //                 )
    //             )
    //         )
    //
    //         assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //         assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
    //     })
    //
    //     it("erc721 to eth order maker eth != who pay, eth orders have no signature, revert", async () => {
    //         await mockERC721.mint(accounts[1], erc721TokenId_1)
    //         await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //         const leftOrder = Order(
    //             accounts[1],
    //             Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //             ZERO_ADDRESS,
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA
    //         )
    //
    //         const rightOrer = Order(
    //             accounts[2],
    //             Asset(ETH_CLASS, EMPTY_DATA, 200),
    //             ZERO_ADDRESS,
    //             Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             EMPTY_DATA
    //         )
    //
    //         let signatureLeft = await getSignature(leftOrder, accounts[1])
    //         await expectThrow(
    //             oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrer,
    //                 signatureLeft,
    //                 EMPTY_DATA,
    //                 {
    //                     from: accounts[3],
    //                     value: 300,
    //                     gasPrice: 0
    //                 }
    //             ),
    //             "bad order signature verification"
    //         )
    //     })
    //
    //     //     it("should match orders with ERC721 сollections", async () => {
    //     //         const matcher = await AssetMatcherCollectionTest.new();
    //     //         await matcher.__AssetMatcherCollection_init();
    //     //         await matcher.addOperator(testing.address);
    //     //
    //     //         await erc721.mint(accounts[1], erc721TokenId1);
    //     //         await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
    //     //
    //     //         const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, "0xffffffff", "0x");
    //     //         const right = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(COLLECTION, enc(erc721.address), 1), 1, 0, 0, "0xffffffff", "0x");
    //     //
    //     //         await testing.setAssetMatcher(COLLECTION, matcher.address);
    //     //
    //     //         await testing.matchOrders(left, await getSignature(left, accounts[1]), right, await getSignature(right, accounts[2]), {value: 300});
    //     //
    //     //         assert.equal(await erc721.balanceOf(accounts[1]), 0);
    //     //         assert.equal(await erc721.balanceOf(accounts[2]), 1);
    //     //     })
    //     // })
    //
    //     describe("test matchOrders() with orders dataType == V1", () => {
    //         it("From erc20(100) to erc20(200) Protocol, Origin fees, no Royalties", async () => {
    //             const {leftOrder, rightOrder} = await gen2O_20Orders(11111, 22222, 100, 200)
    //
    //             await oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrder,
    //                 await getSignature(leftOrder, accounts[1]),
    //                 EMPTY_DATA,
    //                 {from: accounts[2]}
    //             )
    //
    //             assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 100)
    //
    //             assert.equal(await mockERC20_1.balanceOf(accounts[1]), 11111 - 100 - 3 - 1)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[2]), 100 - 3 - 2)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[4]), 2)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[2]), 22222 - 200)
    //             assert.equal(await mockERC20_1.balanceOf(communityAddress), 6)
    //         })
    //
    //         it("From erc20(10) to erc20(20) Protocol, no fees because of floor rounding", async () => {
    //             const {leftOrder, rightOrder} = await gen2O_20Orders(10, 20, 10, 20)
    //
    //             await oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrder,
    //                 await getSignature(leftOrder, accounts[1]),
    //                 EMPTY_DATA,
    //                 {from: accounts[2]}
    //             )
    //
    //             assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 10)
    //
    //             assert.equal(await mockERC20_1.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[2]), 10)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[1]), 20)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[2]), 0)
    //             assert.equal(await mockERC20_1.balanceOf(communityAddress), 0)
    //         })
    //
    //         async function gen2O_20Orders(t1Amount, t2Amount, makeAmount, takeAmount) {
    //             await mockERC20_1.mint(accounts[1], t1Amount)
    //             await mockERC20_2.mint(accounts[2], t2Amount)
    //             await mockERC20_1.approve(mockERC20TransferProxy.address, t1Amount, {from: accounts[1]})
    //             await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
    //             const addOriginLeft = [[accounts[3], makeAmount]]
    //             const addOriginRight = [[accounts[4], takeAmount]]
    //             const encodeDataLeft = await encodeDataV1([[[accounts[1], 10000]], addOriginLeft, true])
    //             const encodeDataRight = await encodeDataV1([[[accounts[2], 10000]], addOriginRight, true])
    //             const leftOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC20_CLASS, encode(mockERC20_1.address), makeAmount),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC20_CLASS, encode(mockERC20_2.address), takeAmount),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodeDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[2],
    //                 Asset(ERC20_CLASS, encode(mockERC20_2.address), takeAmount),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC20_CLASS, encode(mockERC20_1.address), makeAmount),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodeDataRight
    //             )
    //             return {leftOrder, rightOrder}
    //         }
    //
    //         it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties", async () => {
    //             const {leftOrder, rightOrder} = await gen721DV1_20rders(2000)
    //
    //             await oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrder,
    //                 await getSignature(leftOrder, accounts[1]),
    //                 EMPTY_DATA,
    //                 {from: accounts[2]}
    //             )
    //
    //             assert.equal(await oasesExchange.getFilledRecords(
    //                 await mockOrderLibrary.getHashKey(leftOrder)),
    //                 1
    //             )
    //
    //             assert.equal(await mockERC20_2.balanceOf(accounts[5]), 100 - 3 - 1 - 2)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 100 - 3)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
    //             assert.equal(await mockERC20_2.balanceOf(communityAddress), 6)
    //         })
    //
    //         it("From erc20(NO DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties", async () => {
    //             const {leftOrder, rightOrder} = await gen721DV1_20rders(2000)
    //
    //             await oasesExchange.matchOrders(
    //                 rightOrder,
    //                 leftOrder,
    //                 EMPTY_DATA,
    //                 await getSignature(leftOrder, accounts[1]),
    //                 {from: accounts[2]}
    //             )
    //
    //             assert.equal(await oasesExchange.getFilledRecords(
    //                 await mockOrderLibrary.getHashKey(rightOrder)),
    //                 100
    //             )
    //
    //             assert.equal(await mockERC20_2.balanceOf(accounts[5]), 100 - 3 - 1 - 2)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 100 - 3)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
    //             assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
    //             assert.equal(await mockERC20_2.balanceOf(communityAddress), 6)
    //         })
    //
    //         async function gen721DV1_20rders(amount20) {
    //             await mockERC721.mint(accounts[1], erc721TokenId_1)
    //             await mockERC20_2.mint(accounts[2], amount20)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //             await mockERC20_2.approve(mockERC20TransferProxy.address, amount20, {from: accounts[2]})
    //             const addOriginLeft = [[accounts[3], 100], [accounts[4], 200]]
    //             const encodedDataLeft = await encodeDataV1([[[accounts[5], 10000]], addOriginLeft, true])
    //             const encodedDataRight = await encodeDataV1([[], [], true])
    //             const leftOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[2],
    //                 Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             return {leftOrder, rightOrder}
    //         }
    //
    //         it("From erc20(DataV1) to erc1155(DataV1, Royalties) Protocol, Origin fees, Royalties", async () => {
    //             const {leftOrder, rightOrder} = await gen20DV1_1155V1Orders(3000, 100)
    //
    //             await oasesExchange.matchOrders(
    //                 leftOrder,
    //                 rightOrder,
    //                 await getSignature(leftOrder, accounts[1]),
    //                 "0x",
    //                 {from: accounts[2]})
    //
    //             assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)
    //             assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 7)
    //
    //             assert.equal(await mockERC20_1.balanceOf(accounts[1]), 3000 - 1000 - 30 - 40 - 30)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[2]), 0)
    //
    //             assert.equal(await mockERC20_1.balanceOf(accounts[3]), 30)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[4]), 40)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[5]), 50)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[6]), 100)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[7]), 50)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[8]), 0)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[9]), 1000 - 30 - 50 - 100 - 50 + 30 * 2)
    //             assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
    //             assert.equal(await mockERC1155.balanceOf(accounts[8], erc1155TokenId_2), 7)
    //             assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 7)
    //         })
    //
    //         it("From erc1155(DataV1, Royalties) to erc20(DataV1) Protocol, Origin fees, Royalties", async () => {
    //             const {leftOrder, rightOrder} = await gen20DV1_1155V1Orders(3000, 100)
    //
    //             await oasesExchange.matchOrders(
    //                 rightOrder,
    //                 leftOrder,
    //                 EMPTY_DATA,
    //                 await getSignature(leftOrder, accounts[1]),
    //                 {from: accounts[2]})
    //
    //             assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)
    //             assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 7)
    //
    //             assert.equal(await mockERC20_1.balanceOf(accounts[1]), 3000 - 1000 - 30 - 40 - 30)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[2]), 0)
    //
    //             assert.equal(await mockERC20_1.balanceOf(accounts[3]), 30)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[4]), 40)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[5]), 50)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[6]), 100)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[7]), 50)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[8]), 0)
    //             assert.equal(await mockERC20_1.balanceOf(accounts[9]), 1000 - 30 - 50 - 100 - 50 + 30 * 2)
    //             assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
    //             assert.equal(await mockERC1155.balanceOf(accounts[8], erc1155TokenId_2), 7)
    //             assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 7)
    //         })
    //
    //         async function gen20DV1_1155V1Orders(amount20, amount1155) {
    //             await mockERC20_1.mint(accounts[1], amount20)
    //             await mockERC1155.mint(accounts[2], erc1155TokenId_2, amount1155)
    //             await mockERC20_1.approve(mockERC20TransferProxy.address, amount20, {from: accounts[1]})
    //             await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[2]})
    //
    //             const addOriginLeft = [[accounts[3], 300], [accounts[4], 400]]
    //             const addOriginRight = [[accounts[5], 500]]
    //
    //             const encodedDataLeft = await encodeDataV1([[[accounts[8], 10000]], addOriginLeft, true])
    //             const encodedDataRight = await encodeDataV1([[[accounts[9], 10000]], addOriginRight, true])
    //
    //             //set royalties by token
    //             await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC1155.address, [[accounts[6], 1000], [accounts[7], 500]])
    //             await oasesExchange.setFeeReceiver(mockERC20_1.address, protocolFeeReceiver)
    //             const leftOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC20_CLASS, encode(mockERC20_1.address), 1000),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 7),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[2],
    //                 Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 7),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC20_CLASS, encode(mockERC20_1.address), 1000),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             return {leftOrder, rightOrder}
    //         }
    //
    //         it("From eth(DataV1) to erc721(Royalties, DataV1) Protocol, Origin fees, Royalties", async () => {
    //             const {leftOrder, rightOrder} = await genETHDV1_721V1Orders(1000)
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //
    //             await verifyBalanceChange(accounts[2], 50 + 60 + 30 + 1000, async () =>
    //                 verifyBalanceChange(accounts[1], -(1000 - 30 - 70 - 100 - 50), async () =>
    //                     verifyBalanceChange(accounts[3], -50, async () =>
    //                         verifyBalanceChange(accounts[4], -60, async () =>
    //                             verifyBalanceChange(accounts[5], -70, async () =>
    //                                 verifyBalanceChange(accounts[6], -100, async () =>
    //                                     verifyBalanceChange(accounts[7], -50, async () =>
    //                                         verifyBalanceChange(protocolFeeReceiver, -60, () =>
    //                                             oasesExchange.matchOrders(
    //                                                 leftOrder,
    //                                                 rightOrder,
    //                                                 EMPTY_DATA,
    //                                                 signatureRight,
    //                                                 {
    //                                                     from: accounts[2],
    //                                                     value: 2000,
    //                                                     gasPrice: 0
    //                                                 })
    //                                         )
    //                                     )
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
    //         })
    //
    //         it("From erc721(Royalties, DataV1) to eth(DataV1) to  Protocol, Origin fees, Royalties", async () => {
    //             const {leftOrder, rightOrder} = await genETHDV1_721V1Orders(1000)
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //
    //             await verifyBalanceChange(accounts[2], 50 + 60 + 30 + 1000, async () =>
    //                 verifyBalanceChange(accounts[1], -(1000 - 30 - 70 - 100 - 50), async () =>
    //                     verifyBalanceChange(accounts[3], -50, async () =>
    //                         verifyBalanceChange(accounts[4], -60, async () =>
    //                             verifyBalanceChange(accounts[5], -70, async () =>
    //                                 verifyBalanceChange(accounts[6], -100, async () =>
    //                                     verifyBalanceChange(accounts[7], -50, async () =>
    //                                         verifyBalanceChange(protocolFeeReceiver, -60, () =>
    //                                             oasesExchange.matchOrders(
    //                                                 rightOrder,
    //                                                 leftOrder,
    //                                                 signatureRight,
    //                                                 EMPTY_DATA,
    //                                                 {
    //                                                     from: accounts[2],
    //                                                     value: 2000,
    //                                                     gasPrice: 0
    //                                                 })
    //                                         )
    //                                     )
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
    //         })
    //
    //         async function genETHDV1_721V1Orders(amountEth) {
    //             await mockERC721.mint(accounts[1], erc721TokenId_1)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[3], 500], [accounts[4], 600]]
    //             let addOriginRight = [[accounts[5], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             // //set royalties by token
    //             await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC721.address, [[accounts[6], 1000], [accounts[7], 500]])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, amountEth),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, amountEth),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             return {leftOrder, rightOrder}
    //         }
    //
    //         it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_1)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
    //             let addOriginRight = [[accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //             await verifyBalanceChange(accounts[2], 200 + 6 + 10 + 12, async () =>
    //                 verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
    //                     verifyBalanceChange(accounts[5], -10, async () =>
    //                         verifyBalanceChange(accounts[6], -12, async () =>
    //                             verifyBalanceChange(accounts[7], -14, async () =>
    //                                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                     oasesExchange.matchOrders(
    //                                         leftOrder,
    //                                         rightOrder,
    //                                         EMPTY_DATA,
    //                                         signatureRight,
    //                                         {
    //                                             from: accounts[2],
    //                                             value: 300,
    //                                             gasPrice: 0
    //                                         })
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
    //         })
    //
    //         it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_1)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
    //             let addOriginRight = [[accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //             await verifyBalanceChange(accounts[2], 200 + 6 + 10 + 12, async () =>
    //                 verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
    //                     verifyBalanceChange(accounts[5], -10, async () =>
    //                         verifyBalanceChange(accounts[6], -12, async () =>
    //                             verifyBalanceChange(accounts[7], -14, async () =>
    //                                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                     oasesExchange.matchOrders(
    //                                         rightOrder,
    //                                         leftOrder,
    //                                         signatureRight,
    //                                         EMPTY_DATA,
    //                                         {
    //                                             from: accounts[2],
    //                                             value: 300,
    //                                             gasPrice: 0
    //                                         })
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
    //         })
    //
    //         it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_2)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //             await verifyBalanceChange(accounts[2], 200 + 6, async () =>
    //                 verifyBalanceChange(accounts[1], -(200 - 6 - 10 - 12 - 14), async () =>
    //                     verifyBalanceChange(accounts[5], -10, async () =>
    //                         verifyBalanceChange(accounts[6], -12, async () =>
    //                             verifyBalanceChange(accounts[7], -14, async () =>
    //                                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                     oasesExchange.matchOrders(
    //                                         leftOrder,
    //                                         rightOrder,
    //                                         EMPTY_DATA,
    //                                         signatureRight,
    //                                         {
    //                                             from: accounts[2],
    //                                             value: 300,
    //                                             gasPrice: 0
    //                                         })
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
    //         })
    //
    //         it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_2)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //             await verifyBalanceChange(accounts[2], 200 + 6, async () =>
    //                 verifyBalanceChange(accounts[1], -(200 - 6 - 10 - 12 - 14), async () =>
    //                     verifyBalanceChange(accounts[5], -10, async () =>
    //                         verifyBalanceChange(accounts[6], -12, async () =>
    //                             verifyBalanceChange(accounts[7], -14, async () =>
    //                                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                     oasesExchange.matchOrders(
    //                                         rightOrder,
    //                                         leftOrder,
    //                                         signatureRight,
    //                                         EMPTY_DATA,
    //                                         {
    //                                             from: accounts[2],
    //                                             value: 300,
    //                                             gasPrice: 0
    //                                         })
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
    //         })
    //
    //         it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_2)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //             await verifyBalanceChange(accounts[2], 200 + 6 + 10 + 12 + 14, async () =>
    //                 verifyBalanceChange(accounts[1], -(200 - 6), async () =>
    //                     verifyBalanceChange(accounts[5], -10, async () =>
    //                         verifyBalanceChange(accounts[6], -12, async () =>
    //                             verifyBalanceChange(accounts[7], -14, async () =>
    //                                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                     oasesExchange.matchOrders(
    //                                         leftOrder,
    //                                         rightOrder,
    //                                         EMPTY_DATA,
    //                                         signatureRight,
    //                                         {
    //                                             from: accounts[2],
    //                                             value: 300,
    //                                             gasPrice: 0
    //                                         })
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
    //         })
    //
    //         it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_2)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //             await verifyBalanceChange(accounts[2], 200 + 6 + 10 + 12 + 14, async () =>
    //                 verifyBalanceChange(accounts[1], -(200 - 6), async () =>
    //                     verifyBalanceChange(accounts[5], -10, async () =>
    //                         verifyBalanceChange(accounts[6], -12, async () =>
    //                             verifyBalanceChange(accounts[7], -14, async () =>
    //                                 verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                     oasesExchange.matchOrders(
    //                                         leftOrder,
    //                                         rightOrder,
    //                                         EMPTY_DATA,
    //                                         signatureRight,
    //                                         {
    //                                             from: accounts[2],
    //                                             value: 300,
    //                                             gasPrice: 0
    //                                         })
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
    //         })
    //
    //         it("From eth(DataV1) to erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB!!! not enough eth", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_2)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //
    //             await expectThrow(
    //                 oasesExchange.matchOrders(
    //                     rightOrder,
    //                     leftOrder,
    //                     await getSignature(rightOrder, accounts[1]),
    //                     EMPTY_DATA,
    //                     {
    //                         from: accounts[2],
    //                         value: 300,
    //                         gasPrice: 0
    //                     }),
    //                 "bad eth transfer"
    //             )
    //         })
    //
    //         it("From erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB!!! not enough eth", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_2)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, EMPTY_DATA, 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //
    //             await expectThrow(
    //                 oasesExchange.matchOrders(
    //                     leftOrder,
    //                     rightOrder,
    //                     EMPTY_DATA,
    //                     await getSignature(rightOrder, accounts[1]),
    //                     {
    //                         from: accounts[2],
    //                         value: 300,
    //                         gasPrice: 0
    //                     }),
    //                 "bad eth transfer"
    //             )
    //         })
    //
    //         it("From eth(DataV1) to erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB!!! not enough ETH for lastOrigin and seller!", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_1)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [];
    //             let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, "0x", 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, "0x", 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //
    //             await verifyBalanceChange(accounts[2], 206, async () =>			//200 + 6 buyerFee
    //                 verifyBalanceChange(accounts[1], 0, async () =>				//200 - 6 seller - 180 - 10 - 12(really 10) - 14(really 0) origin left
    //                     verifyBalanceChange(accounts[3], -180, async () =>
    //                         verifyBalanceChange(accounts[5], -10, async () =>
    //                             verifyBalanceChange(accounts[6], -4, async () =>
    //                                 verifyBalanceChange(accounts[7], 0, async () =>
    //                                     verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                         oasesExchange.matchOrders(
    //                                             leftOrder,
    //                                             rightOrder,
    //                                             EMPTY_DATA,
    //                                             signatureRight,
    //                                             {
    //                                                 from: accounts[2],
    //                                                 value: 300,
    //                                                 gasPrice: 0
    //                                             })
    //                                     )
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
    //         })
    //
    //         it("From erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB!!! not enough ETH for lastOrigin and seller!", async () => {
    //             await mockERC721.mint(accounts[1], erc721TokenId_1)
    //             await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
    //
    //             let addOriginLeft = [];
    //             let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]
    //
    //             let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
    //             let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])
    //
    //             const leftOrder = Order(
    //                 accounts[2],
    //                 Asset(ETH_CLASS, "0x", 200),
    //                 ZERO_ADDRESS,
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataLeft
    //             )
    //             const rightOrder = Order(
    //                 accounts[1],
    //                 Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
    //                 ZERO_ADDRESS,
    //                 Asset(ETH_CLASS, "0x", 200),
    //                 1,
    //                 0,
    //                 0,
    //                 ORDER_V1_DATA_TYPE,
    //                 encodedDataRight
    //             )
    //             let signatureRight = await getSignature(rightOrder, accounts[1])
    //
    //             await verifyBalanceChange(accounts[2], 206, async () =>			//200 + 6 buyerFee
    //                 verifyBalanceChange(accounts[1], 0, async () =>				//200 - 6 seller - 180 - 10 - 12(really 10) - 14(really 0) origin left
    //                     verifyBalanceChange(accounts[3], -180, async () =>
    //                         verifyBalanceChange(accounts[5], -10, async () =>
    //                             verifyBalanceChange(accounts[6], -4, async () =>
    //                                 verifyBalanceChange(accounts[7], 0, async () =>
    //                                     verifyBalanceChange(protocolFeeReceiver, -12, () =>
    //                                         oasesExchange.matchOrders(
    //                                             rightOrder,
    //                                             leftOrder,
    //                                             signatureRight,
    //                                             EMPTY_DATA,
    //                                             {
    //                                                 from: accounts[2],
    //                                                 value: 300,
    //                                                 gasPrice: 0
    //                                             })
    //                                     )
    //                                 )
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //             assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
    //             assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
    //         })
    //     })

    describe("test matchOrders(), orders dataType == V1, multipleBeneficiary", () => {
        it("From erc20(100) to erc20(200) Protocol, Origin fees, no Royalties, payouts: 1)20/80%, 2)50/50%", async () => {
            const {leftOrder, rightOrder} = await prepare20Orders(1000, 2000)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(
                await oasesExchange.getFilledRecords(
                    await mockOrderLibrary.getHashKey(leftOrder)),
                100
            )

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000 - 100 - 3 - 1)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), (100 - 3 - 2) * 0.2)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), (100 - 3 - 2) * 0.8)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200 * 0.5)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 200 * 0.5)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 200)
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 6)
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 0)
        })

        async function prepare20Orders(t1Amount, t2Amount) {
            await mockERC20_1.mint(accounts[1], t1Amount)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC20_1.approve(mockERC20TransferProxy.address, t1Amount, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100]]
            let addOriginRight = [[accounts[4], 200]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[5], 5000]], addOriginLeft, true])
            let encodeDataRight = await encodeDataV1([[[accounts[2], 2000], [accounts[6], 8000]], addOriginRight, true])
            const leftOrder = Order(
                accounts[1],
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[2],
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 200),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodeDataRight
            )
            return {leftOrder, rightOrder}
        }

        it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            const {leftOrder, rightOrder} = await prepare721DV1_20Orders(1000)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)),
                1
            )

            const amount = Math.floor((100 - 3 - 1 - 2 - 3) / 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), amount)
            assert.equal(await mockERC20_2.balanceOf(accounts[6]), 100 - 3 - 1 - 2 - 3 - amount)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100 - 3)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 6)
        })

        async function prepare721DV1_20Orders(t2Amount) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100], [accounts[4], 200], [accounts[5], 300]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[6], 5000]], addOriginLeft, true])
            const leftOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[2],
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            return {leftOrder, rightOrder}
        }

        it("From erc20(NO DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            const {leftOrder, rightOrder} = await prepare721DV1_20Orders(1000)

            await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                EMPTY_DATA,
                await getSignature(leftOrder, accounts[1]),
                {from: accounts[2]}
            )

            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)),
                1
            )

            const amount = Math.floor((100 - 3 - 1 - 2 - 3) / 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), amount)
            assert.equal(await mockERC20_2.balanceOf(accounts[6]), 100 - 3 - 1 - 2 - 3 - amount)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100 - 3)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 6)
        })

        it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, payouts: 110%, throw", async () => {
            const {leftOrder, rightOrder} = await prepare721DV1_20_110CentsOrders(1000)

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    await getSignature(leftOrder, accounts[1]),
                    EMPTY_DATA,
                    {from: accounts[2]}
                ),
                "total bp of payment is not 100%"
            )
        })

        async function prepare721DV1_20_110CentsOrders(t2Amount) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100], [accounts[4], 200]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[5], 5001]], addOriginLeft, true])
            const leftOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[2],
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            return {leftOrder, rightOrder}
        }

        it("From erc20(NO DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: 110%, throw", async () => {
            const {leftOrder, rightOrder} = await prepare721DV1_20_110CentsOrders(1000)

            await expectThrow(
                oasesExchange.matchOrders(
                    rightOrder,
                    leftOrder,
                    EMPTY_DATA,
                    await getSignature(leftOrder, accounts[1]),
                    {from: accounts[2]}
                ),
                "total bp of payment is not 100%"
            )
        })

//         it("From ETH(DataV1) to ERC721(DataV1) Protocol, Origin fees,  no Royalties, payouts: 50/50%", async () => {
//             await erc721.mint(accounts[1], erc721TokenId1);
//             await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
//
//             let addrOriginLeft = [[accounts[5], 500], [accounts[6], 600]];
//             let addrOriginRight = [[accounts[7], 700]];
//
//             let encDataLeft = await encDataV1([ [[accounts[2], 10000]], addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [[accounts[1], 5000], [accounts[3], 5000]], addrOriginRight ]);
//
//             const left = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//             let signatureRight = await getSignature(right, accounts[1]);
//             await verifyBalanceChange(accounts[2], 228, async () =>			//200+6buyerFee+ (10 +12 origin left) (72back)
//                 verifyBalanceChange(accounts[3], -90, async () =>				//200 -6seller - 14 originright *50%
//                     verifyBalanceChange(accounts[1], -90, async () =>				//200 -6seller - 14 originright *50%
//                         verifyBalanceChange(accounts[5], -10, async () =>
//                             verifyBalanceChange(accounts[6], -12, async () =>
//                                 verifyBalanceChange(accounts[7], -14, async () =>
//                                     verifyBalanceChange(protocol, -12, () =>
//                                         testing.matchOrders(left, "0x", right, signatureRight, { from: accounts[2], value: 300, gasPrice: 0 })
//                                     )
//                                 )
//                             )
//                         )
//                     )
//                 )
//             )
//             assert.equal(await erc721.balanceOf(accounts[1]), 0);
//             assert.equal(await erc721.balanceOf(accounts[2]), 1);
//         })
//
//         it("From ETH(DataV1) to ERC721(DataV1) Protocol, Origin fees,  no Royalties, payouts: empy 100% to order.maker", async () => {
//             await erc721.mint(accounts[1], erc721TokenId1);
//             await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
//
//             let addrOriginLeft = [[accounts[5], 500], [accounts[6], 600]];
//             let addrOriginRight = [[accounts[7], 700]];
//
//             let encDataLeft = await encDataV1([ [[accounts[2], 10000]], addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [], addrOriginRight ]); //empty payout
//
//             const left = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//             let signatureRight = await getSignature(right, accounts[1]);
//             await verifyBalanceChange(accounts[2], 228, async () =>			//200+6buyerFee+ (10 +12 origin left) (72back)
//                 verifyBalanceChange(accounts[1], -180, async () =>				//200 -6seller - 14 originright *100%
//                     verifyBalanceChange(accounts[5], -10, async () =>
//                         verifyBalanceChange(accounts[6], -12, async () =>
//                             verifyBalanceChange(accounts[7], -14, async () =>
//                                 verifyBalanceChange(protocol, -12, () =>
//                                     testing.matchOrders(left, "0x", right, signatureRight, { from: accounts[2], value: 300, gasPrice: 0 })
//                                 )
//                             )
//                         )
//                     )
//                 )
//             )
//             assert.equal(await erc721.balanceOf(accounts[1]), 0);
//             assert.equal(await erc721.balanceOf(accounts[2]), 1);
//         })
//
//
//     })	//Do matchOrders(), orders dataType == V1, MultipleBeneficiary
//
//     describe("Catch emit event Transfer", () => {
//         it("From ETH(DataV1) to ERC721(DataV1) Protocol, check emit ", async () => {
//             const seller = accounts[1];
//             const sellerRoyaltiy = accounts[4];
//             const seller2 = accounts[3];
//             const buyer = accounts[2];
//             const originLeft1 = accounts[5];
//             const originLeft2 = accounts[6];
//             const originRight = accounts[7];
//
//             await erc721V1.mint(seller, erc721TokenId1, [[sellerRoyaltiy, 1000]]);
//             await erc721V1.setApprovalForAll(transferProxy.address, true, {from: seller});
//
//             let addrOriginLeft = [[originLeft1, 500], [originLeft2, 600]];
//             let addrOriginRight = [[originRight, 700]];
//             let encDataLeft = await encDataV1([ [[buyer, 10000]], addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [[seller, 5000], [seller2, 5000]], addrOriginRight ]);
//
//             const left = Order(buyer, Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(seller, Asset(ERC721, enc(erc721V1.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//             let signatureRight = await getSignature(right, seller);
//             let tx = await testing.matchOrders(left, "0x", right, signatureRight, { from: buyer, value: 300, gasPrice: 0 });
//             let errorCounter = 0
// //			eventEmitted  - срабатывает по нескольким transfer, для фиксации ошибки нужно чтоб все трансферы завалились
//             truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
//                 let result = false;
//                 switch (ev.to){
//                     case protocol:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != PROTOCOL)) {
//                             console.log("Error in protocol check:");
//                             errorCounter++;
//                         }
//                         break
//                     case seller:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != PAYOUT) ) {
//                             console.log("Error in seller check:");
//                             errorCounter++;
//                         }
//                         break
//                     case sellerRoyaltiy:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != ROYALTY) ) {
//                             console.log("Error in seller check:");
//                             errorCounter++;
//                         }
//                         break
//                     case seller2:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != PAYOUT) ) {
//                             console.log("Error in seller2 check:");
//                             errorCounter++;
//                         }
//                         break
//                     case originLeft1:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != ORIGIN) ) {
//                             console.log("Error in originLeft1 check:");
//                             errorCounter++;
//                         }
//                         break
//                     case originLeft2:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != ORIGIN) ) {
//                             console.log("Error in originLeft2 check:");
//                             errorCounter++;
//                         }
//                         break
//                     case originRight:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != ORIGIN) ) {
//                             console.log("Error in originRight check:");
//                             errorCounter++;
//                         }
//                         break
//                     case buyer:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != PAYOUT) ){
//                             console.log("Error in buyer check:");
//                             errorCounter++;
//                         }
//                         break
//                 }
//                 if (errorCounter > 0) {
//                     result = false;
//                 } else {
//                     result = true;
//                 }
//                 return result;
//             }, "Transfer shuold be emietted with correct parameters ");
//             assert.equal(errorCounter, 0); //фиксируем наличие ошибок тут
//         })
//
//         it("From ERC1155(DataV2) to ETH(DataV1) Protocol, check emit ", async () => {
//             const seller = accounts[1];
//             const sellerRoyaltiy = accounts[4];
//             const seller2 = accounts[3];
//             const buyer = accounts[2];
//             const originLeft1 = accounts[5];
//             const originLeft2 = accounts[6];
//             const originRight = accounts[7];
//
//             await erc1155_v2.mint(seller, erc1155TokenId1, [[sellerRoyaltiy, 1000]], 10);
//             await erc1155_v2.setApprovalForAll(transferProxy.address, true, {from: seller});
//
//             let addrOriginLeft = [[originLeft1, 500], [originLeft2, 600]];
//             let addrOriginRight = [[originRight, 700]];
//             let encDataLeft = await encDataV1([ [[seller, 5000], [seller2, 5000]] , addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [[buyer, 10000]], addrOriginRight ]);
//
//             const left = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 5), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(buyer, Asset(ETH, "0x", 200), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 5), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//
//             let signatureRight = await getSignature(right, buyer);
//             let tx = await testing.matchOrders(left, "0x", right, signatureRight, { from: seller, value: 300, gasPrice: 0 });
//             let errorCounter = 0
// //			eventEmitted  - срабатывает по нескольким transfer, для фиксации ошибки нужно чтоб все трансферы завалились
//             truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
//                 let result = false;
//                 switch (ev.to){
//                     case protocol:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != PROTOCOL)) {
//                             console.log("Error in protocol check:");
//                             errorCounter++;
//                         }
//                         break
//                     case seller:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != PAYOUT) ) {
//                             console.log("Error in seller check:");
//                             errorCounter++;
//                         }
//                         break
//                     case sellerRoyaltiy:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != ROYALTY) ) {
//                             console.log("Error in seller check:");
//                             errorCounter++;
//                         }
//                         break
//                     case seller2:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != PAYOUT) ) {
//                             console.log("Error in seller2 check:");
//                             errorCounter++;
//                         }
//                         break
//                     case originLeft1:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != ORIGIN) ) {
//                             console.log("Error in originLeft1 check:");
//                             errorCounter++;
//                         }
//                         break
//                     case originLeft2:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != ORIGIN) ) {
//                             console.log("Error in originLeft2 check:");
//                             errorCounter++;
//                         }
//                         break
//                     case originRight:
//                         if ((ev.transferDirection != TO_MAKER) && (ev.transferType != ORIGIN) ) {
//                             console.log("Error in originRight check:");
//                             errorCounter++;
//                         }
//                         break
//                     case buyer:
//                         if ((ev.transferDirection != TO_TAKER) && (ev.transferType != PAYOUT) ){
//                             console.log("Error in buyer check:");
//                             errorCounter++;
//                         }
//                         break
//                 }
//                 if (errorCounter > 0) {
//                     result = false;
//                 } else {
//                     result = true;
//                 }
//                 return result;
//             }, "Transfer shuold be emietted with correct parameters ");
//             assert.equal(errorCounter, 0); //фиксируем наличие ошибок тут
//         })
//
//     }) //Catch emit event Transfer
//
//     describe("Exchange with Royalties", () => {
//         it("Royalties by owner, token 721 to ETH", async () => {
//             await erc721.mint(accounts[1], erc721TokenId1);
//             await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
//             await royaltiesRegistry.setRoyaltiesByToken(erc721.address, [[accounts[3], 500], [accounts[4], 1000]]); //set royalties by token
//             let addrOriginLeft = [[accounts[5], 500], [accounts[6], 600]];
//             let addrOriginRight = [[accounts[7], 700]];
//
//             let encDataLeft = await encDataV1([ [[accounts[2], 10000]], addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [[accounts[1], 10000]], addrOriginRight ]);
//
//             const left = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//             let signatureRight = await getSignature(right, accounts[1]);
//             await verifyBalanceChange(accounts[2], 228, async () =>			//200+6buyerFee+ (10 +12 origin left) (72back)
//                 verifyBalanceChange(accounts[1], -150, async () =>				//200 -6seller - 14 originright
//                     verifyBalanceChange(accounts[3], -10, async () =>
//                         verifyBalanceChange(accounts[4], -20, async () =>
//                             verifyBalanceChange(accounts[5], -10, async () =>
//                                 verifyBalanceChange(accounts[6], -12, async () =>
//                                     verifyBalanceChange(accounts[7], -14, async () =>
//                                         verifyBalanceChange(protocol, -12, () =>
//                                             testing.matchOrders(left, "0x", right, signatureRight, { from: accounts[2], value: 300, gasPrice: 0 })
//                                         )
//                                     )
//                                 )
//                             )
//                         )
//                     )
//                 )
//             )
//             assert.equal(await erc721.balanceOf(accounts[1]), 0);
//             assert.equal(await erc721.balanceOf(accounts[2]), 1);
//
//         })
//         it("Royalties by owner, token and tokenId 721 to ETH", async () => {
//             await erc721.mint(accounts[1], erc721TokenId1);
//             await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
//             await royaltiesRegistry.setRoyaltiesByTokenAndTokenId(erc721.address, erc721TokenId1, [[accounts[3], 500], [accounts[4], 1000]]); //set royalties by token and tokenId
//             let addrOriginLeft = [[accounts[5], 500], [accounts[6], 600]];
//             let addrOriginRight = [[accounts[7], 700]];
//
//             let encDataLeft = await encDataV1([ [[accounts[2], 10000]], addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [[accounts[1], 10000]], addrOriginRight ]);
//
//             const left = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//             let signatureRight = await getSignature(right, accounts[1]);
//             await verifyBalanceChange(accounts[2], 228, async () =>			//200+6buyerFee+ (10 +12 origin left) (72back)
//                 verifyBalanceChange(accounts[1], -150, async () =>				//200 -6seller - 14 originright
//                     verifyBalanceChange(accounts[3], -10, async () =>
//                         verifyBalanceChange(accounts[4], -20, async () =>
//                             verifyBalanceChange(accounts[5], -10, async () =>
//                                 verifyBalanceChange(accounts[6], -12, async () =>
//                                     verifyBalanceChange(accounts[7], -14, async () =>
//                                         verifyBalanceChange(protocol, -12, () =>
//                                             testing.matchOrders(left, "0x", right, signatureRight, { from: accounts[2], value: 300, gasPrice: 0 })
//                                         )
//                                     )
//                                 )
//                             )
//                         )
//                     )
//                 )
//             )
//             assert.equal(await erc721.balanceOf(accounts[1]), 0);
//             assert.equal(await erc721.balanceOf(accounts[2]), 1);
//
//         })
//
//         it("Royalties by token and tokenId 721v1_OwnableUpgradaeble to ETH", async () => {
//             let ownerErc721 = accounts[6];
//             ERC721_V1OwnUpgrd = await TestERC721RoyaltyV1OwnUpgrd.new("Rarible", "RARI", "https://ipfs.rarible.com", {from: ownerErc721 });
//             await ERC721_V1OwnUpgrd.initialize( {from: ownerErc721});
//
//             await ERC721_V1OwnUpgrd.mint(accounts[1], erc721TokenId1, []);
//             await ERC721_V1OwnUpgrd.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
//             await royaltiesRegistry.setRoyaltiesByTokenAndTokenId(ERC721_V1OwnUpgrd.address, erc721TokenId1, [[accounts[3], 500], [accounts[4], 1000]], {from: ownerErc721}); //set royalties by token and tokenId
//             let addrOriginLeft = [[accounts[5], 500]];
//             let addrOriginRight = [[accounts[7], 700]];
//
//             let encDataLeft = await encDataV1([ [[accounts[2], 10000]], addrOriginLeft ]);
//             let encDataRight = await encDataV1([ [[accounts[1], 10000]], addrOriginRight ]);
//
//             const left = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(ERC721, enc(ERC721_V1OwnUpgrd.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
//             const right = Order(accounts[1], Asset(ERC721, enc(ERC721_V1OwnUpgrd.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, ORDER_DATA_V1, encDataRight);
//             let signatureRight = await getSignature(right, accounts[1]);
//             await verifyBalanceChange(accounts[2], 216, async () =>			//200+6buyerFee+ (10  origin left) (72back)
//                 verifyBalanceChange(accounts[1], -150, async () =>				//200 -6seller - 14 originright
//                     verifyBalanceChange(accounts[3], -10, async () =>
//                         verifyBalanceChange(accounts[4], -20, async () =>
//                             verifyBalanceChange(accounts[5], -10, async () =>
//                                 verifyBalanceChange(accounts[7], -14, async () =>
//                                     verifyBalanceChange(protocol, -12, () =>
//                                         testing.matchOrders(left, "0x", right, signatureRight, { from: accounts[2], value: 300, gasPrice: 0 })
//                                     )
//                                 )
//                             )
//                         )
//                     )
//                 )
//             )
//             assert.equal(await ERC721_V1OwnUpgrd.balanceOf(accounts[1]), 0);
//             assert.equal(await ERC721_V1OwnUpgrd.balanceOf(accounts[2]), 1);
//
//         })
//
//     })
//
//     describe("matchOrders, orderType = V2", () => {
//         it("should correctly calculate make-side fill for isMakeFill = true ", async () => {
//             const seller = accounts[1];
//             const buyer = accounts[2];
//             const buyer1 = accounts[3];
//
//             await erc1155_v2.mint(seller, erc1155TokenId1, [], 200);
//             await erc1155_v2.setApprovalForAll(transferProxy.address, true, { from: seller });
//
//             const encDataLeft = await encDataV2([[], [], true]);
//             const encDataRight = await encDataV2([[], [], false]);
//
//             const left = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), ZERO, Asset(ETH, "0x", 1000), 1, 0, 0, ORDER_DATA_V2, encDataLeft);
//             const right = Order(buyer, Asset(ETH, "0x", 500), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V2, encDataRight);
//
//             await verifyBalanceChange(seller, -485, async () =>
//                 verifyBalanceChange(buyer, 515, async () =>
//                     testing.matchOrders(left, await getSignature(left, seller), right, "0x", { from: buyer, value: 600, gasPrice: 0 })
//                 )
//             )
//             assert.equal(await erc1155_v2.balanceOf(buyer, erc1155TokenId1), 100);
//             assert.equal(await erc1155_v2.balanceOf(seller, erc1155TokenId1), 100);
//
//             const leftOrderHash = await libOrder.hashKey(left);
//             const test_hash = await libOrder.hashV2(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), Asset(ETH, "0x", 1000), 1, encDataLeft)
//             assert.equal(leftOrderHash, test_hash, "correct hash for V2")
//             assert.equal(await testing.fills(leftOrderHash), 100, "left fill make side")
//
//             const left1 = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), ZERO, Asset(ETH, "0x", 600), 1, 0, 0, ORDER_DATA_V2, encDataLeft);
//             const right1 = Order(buyer1, Asset(ETH, "0x", 300), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V2, encDataRight);
//
//             await verifyBalanceChange(seller, -291, async () =>
//                 verifyBalanceChange(buyer1, 309, async () =>
//                     testing.matchOrders(left1, await getSignature(left1, seller), right1, "0x", { from: buyer1, value: 600, gasPrice: 0 })
//                 )
//             )
//             assert.equal(await testing.fills(leftOrderHash), 200, "left fill make side 1")
//             assert.equal(await erc1155_v2.balanceOf(buyer1, erc1155TokenId1), 100);
//             assert.equal(await erc1155_v2.balanceOf(seller, erc1155TokenId1), 0);
//         })
//
//         it("should correctly calculate take-side fill for isMakeFill = false ", async () => {
//             const seller = accounts[1];
//             const buyer = accounts[2];
//             const buyer1 = accounts[3];
//
//             await erc1155_v2.mint(seller, erc1155TokenId1, [], 200);
//             await erc1155_v2.setApprovalForAll(transferProxy.address, true, { from: seller });
//
//             const encDataLeft = await encDataV2([[], [], false]);
//             const encDataRight = await encDataV2([[], [], false]);
//
//             const left = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), ZERO, Asset(ETH, "0x", 1000), 1, 0, 0, ORDER_DATA_V2, encDataLeft);
//             const right = Order(buyer, Asset(ETH, "0x", 500), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V2, encDataRight);
//
//             await verifyBalanceChange(seller, -485, async () =>
//                 verifyBalanceChange(buyer, 515, async () =>
//                     testing.matchOrders(left, await getSignature(left, seller), right, "0x", { from: buyer, value: 600, gasPrice: 0 })
//                 )
//             )
//             assert.equal(await erc1155_v2.balanceOf(buyer, erc1155TokenId1), 100);
//             assert.equal(await erc1155_v2.balanceOf(seller, erc1155TokenId1), 100);
//
//             const leftOrderHash = await libOrder.hashKey(left);
//             assert.equal(await testing.fills(leftOrderHash), 500, "left fill make side")
//
//             const left1 = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), ZERO, Asset(ETH, "0x", 2000), 1, 0, 0, ORDER_DATA_V2, encDataLeft);
//             const right1 = Order(buyer1, Asset(ETH, "0x", 1000), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V2, encDataRight);
//
//             await verifyBalanceChange(seller, -970, async () =>
//                 verifyBalanceChange(buyer1, 1030, async () =>
//                     testing.matchOrders(left1, await getSignature(left1, seller), right1, "0x", { from: buyer1, value: 1100, gasPrice: 0 })
//                 )
//             )
//
//             assert.equal(await erc1155_v2.balanceOf(buyer1, erc1155TokenId1), 100);
//             assert.equal(await erc1155_v2.balanceOf(seller, erc1155TokenId1), 0);
//             assert.equal(await testing.fills(leftOrderHash), 1500, "left fill make side 1")
//         })
//
//         it("should correctly calculate make-side fill for isMakeFill = true and originFees ", async () => {
//             const seller = accounts[1];
//             const buyer = accounts[2];
//             const buyer1 = accounts[3];
//
//             await erc1155_v2.mint(seller, erc1155TokenId1, [], 200);
//             await erc1155_v2.setApprovalForAll(transferProxy.address, true, { from: seller });
//
//             const encDataLeft = await encDataV2([[[seller, 10000]], [[accounts[5], 1000]], true]);
//             const encDataRight = await encDataV2([[], [], false]);
//
//             const left = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), ZERO, Asset(ETH, "0x", 1000), 1, 0, 0, ORDER_DATA_V2, encDataLeft);
//             const right = Order(buyer, Asset(ETH, "0x", 500), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V2, encDataRight);
//
//             await verifyBalanceChange(seller, -435, async () =>
//                 verifyBalanceChange(buyer, 515, async () =>
//                     verifyBalanceChange(accounts[5], -50, async () =>
//                         testing.matchOrders(left, await getSignature(left, seller), right, "0x", { from: buyer, value: 600, gasPrice: 0 })
//                     )
//                 )
//             )
//             assert.equal(await erc1155_v2.balanceOf(buyer, erc1155TokenId1), 100);
//             assert.equal(await erc1155_v2.balanceOf(seller, erc1155TokenId1), 100);
//
//             const leftOrderHash = await libOrder.hashKey(left);
//             const test_hash = await libOrder.hashV2(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), Asset(ETH, "0x", 1000), 1, encDataLeft)
//             assert.equal(leftOrderHash, test_hash, "correct hash for V2")
//             assert.equal(await testing.fills(leftOrderHash), 100, "left fill make side")
//
//             const left1 = Order(seller, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 200), ZERO, Asset(ETH, "0x", 600), 1, 0, 0, ORDER_DATA_V2, encDataLeft);
//             const right1 = Order(buyer1, Asset(ETH, "0x", 300), ZERO, Asset(ERC1155, enc(erc1155_v2.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V2, encDataRight);
//
//             await verifyBalanceChange(seller, -261, async () =>
//                 verifyBalanceChange(buyer1, 309, async () =>
//                     verifyBalanceChange(accounts[5], -30, async () =>
//                         testing.matchOrders(left1, await getSignature(left1, seller), right1, "0x", { from: buyer1, value: 600, gasPrice: 0 })
//                     )
//                 )
//             )
//             assert.equal(await testing.fills(leftOrderHash), 200, "left fill make side 1")
//             assert.equal(await erc1155_v2.balanceOf(buyer1, erc1155TokenId1), 100);
//             assert.equal(await erc1155_v2.balanceOf(seller, erc1155TokenId1), 0);
//         })
//
//     })
//
        function encodeDataV1(tuple) {
            return mockOasesCashierManager.encodeDataV1(tuple)
        }

        async function getSignature(order, signer) {
            return sign(order, signer, oasesExchange.address)
        }
    })
})