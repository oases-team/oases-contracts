const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades')
const truffleAssert = require('truffle-assertions')
const OasesExchange = artifacts.require("OasesExchange.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const MockRoyaltiesRegistry = artifacts.require("MockRoyaltiesRegistry.sol")
const MockOasesCashierManager = artifacts.require("MockOasesCashierManager.sol")
const MockOrderLibrary = artifacts.require("MockOrderLibrary.sol")

const {Order, Asset, sign, EMPTY_DATA, ORDER_V1_DATA_TYPE} = require("./types/order")
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_FLAG_ADDRESS = ZERO_ADDRESS
const {
    encode,
    ETH_CLASS,
    ERC20_CLASS,
    ERC721_CLASS,
    ERC1155_CLASS,
    TO_MAKER_DIRECTION,
    TO_TAKER_DIRECTION,
    PROTOCOL_FEE,
    ROYALTY,
    ORIGIN_FEE,
    PAYMENT
} = require("./types/assets")
const {getRandomInteger} = require('./utils/utils')

contract("test OasesExchange.sol (protocol fee 3% —— seller 3%)", accounts => {
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

    describe("test cancelOrders()", () => {
        it("revert if right order is cancelled", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            const encodedDataLeft = await encodeDataV1([[], [], true])
            const encodedDataRight = await encodeDataV1([[], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureRight = await getSignature(rightOrder, accounts[1])
            await oasesExchange.cancelOrder(rightOrder, {from: accounts[1]})
            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 2 ** 256 - 1)

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    EMPTY_DATA,
                    signatureRight,
                    {
                        from: accounts[2],
                        value: 300,
                        gasPrice: 0
                    }),
                "Arithmetic overflow"
            )
        })

        it("revert if msg.sender is not the order's maker", async () => {
            const encodedData = await encodeDataV1([[], [], true])
            const order = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            await expectThrow(
                oasesExchange.cancelOrder(order, {from: accounts[1]}),
                'not the order maker'
            )
        })

        it("revert if salt in order is 0", async () => {
            const encodedData = await encodeDataV1([[], [], true])
            const order = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                0,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            await expectThrow(
                oasesExchange.cancelOrder(order, {from: accounts[2]}),
                'salt 0 cannot be cancelled'
            )
        })
    })

    describe("test matchOrders()", () => {
        it("eth orders work. revert when eth is not enough", async () => {
            await mockERC20_1.mint(accounts[1], 10000)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 10000, {from: accounts[1]})

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            const rightOrder = Order(
                accounts[1],
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA)

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    EMPTY_DATA,
                    await getSignature(rightOrder, accounts[1]),
                    {
                        from: accounts[2],
                        value: 199
                    }),
                "bad eth transfer"
            )
        })

        it("eth orders work. revert with unknown data type of order", async () => {
            await mockERC20_1.mint(accounts[1], 100)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 10000, {from: accounts[1]})

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            const rightOrder = Order(
                accounts[1],
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xfffffffe",
                EMPTY_DATA
            )

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    EMPTY_DATA,
                    await getSignature(rightOrder, accounts[1]),
                    {
                        from: accounts[2],
                        value: 300
                    }),
                "unsupported order data type"
            )
        })

        it("eth orders work. rest is returned to taker (other side)", async () => {
            await mockERC20_1.mint(accounts[1], 100)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 100, {from: accounts[1]})

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA)

            const rightOrder = Order(
                accounts[1],
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA)

            const signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], -194, async () =>
                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                        oasesExchange.matchOrders(
                            leftOrder,
                            rightOrder,
                            EMPTY_DATA,
                            signatureRight,
                            {
                                from: accounts[2],
                                value: 300,
                                gasPrice: 0
                            })
                    )
                )
            )

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 100)
        })

        it("erc721 to eth order maker eth != who pay, both orders have to be with signatures", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            const leftOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            const rightOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            let signatureLeft = await getSignature(leftOrder, accounts[1])
            let signatureRight = await getSignature(rightOrder, accounts[2])
            await verifyBalanceChange(accounts[3], 200, async () =>
                verifyBalanceChange(accounts[1], -194, async () =>
                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                        // NB! from: accounts[3] - who pay for NFT != order Maker
                        oasesExchange.matchOrders(
                            leftOrder,
                            rightOrder,
                            signatureLeft,
                            signatureRight,
                            {
                                from: accounts[3],
                                value: 300,
                                gasPrice: 0
                            })
                    )
                )
            )

            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
        })

        it("erc721 to eth order maker eth != who pay, eth orders have no signature, revert", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            const leftOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            const rightOrer = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            let signatureLeft = await getSignature(leftOrder, accounts[1])
            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrer,
                    signatureLeft,
                    EMPTY_DATA,
                    {
                        from: accounts[3],
                        value: 300,
                        gasPrice: 0
                    }
                ),
                "bad order signature verification"
            )
        })

        //     it("should match orders with ERC721 сollections", async () => {
        //         const matcher = await AssetMatcherCollectionTest.new();
        //         await matcher.__AssetMatcherCollection_init();
        //         await matcher.addOperator(testing.address);
        //
        //         await erc721.mint(accounts[1], erc721TokenId1);
        //         await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
        //
        //         const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ETH, "0x", 200), 1, 0, 0, "0xffffffff", "0x");
        //         const right = Order(accounts[2], Asset(ETH, "0x", 200), ZERO, Asset(COLLECTION, enc(erc721.address), 1), 1, 0, 0, "0xffffffff", "0x");
        //
        //         await testing.setAssetMatcher(COLLECTION, matcher.address);
        //
        //         await testing.matchOrders(left, await getSignature(left, accounts[1]), right, await getSignature(right, accounts[2]), {value: 300});
        //
        //         assert.equal(await erc721.balanceOf(accounts[1]), 0);
        //         assert.equal(await erc721.balanceOf(accounts[2]), 1);
        //     })
    })

    describe("test matchOrders() with orders dataType == V1", () => {
        it("From erc20(100) to erc20(200) Protocol, Origin fees, no Royalties", async () => {
            const {leftOrder, rightOrder} = await gen2O_20Orders(11111, 22222, 100, 200)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 100)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 11111 - 100 - 1)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 100 - 3 - 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 22222 - 200)
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 3)
        })

        it("From erc20(10) to erc20(20) Protocol, no fees because of floor rounding", async () => {
            const {leftOrder, rightOrder} = await gen2O_20Orders(10, 20, 10, 20)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 10)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 10)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 20)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 0)
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 0)
        })

        async function gen2O_20Orders(t1Amount, t2Amount, makeAmount, takeAmount) {
            await mockERC20_1.mint(accounts[1], t1Amount)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC20_1.approve(mockERC20TransferProxy.address, t1Amount, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            const addOriginLeft = [[accounts[3], makeAmount]]
            const addOriginRight = [[accounts[4], takeAmount]]
            const encodeDataLeft = await encodeDataV1([[[accounts[1], 10000]], addOriginLeft, true])
            const encodeDataRight = await encodeDataV1([[[accounts[2], 10000]], addOriginRight, true])
            const leftOrder = Order(
                accounts[1],
                Asset(ERC20_CLASS, encode(mockERC20_1.address), makeAmount),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), takeAmount),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodeDataLeft
            )
            const rightOrder = Order(
                accounts[2],
                Asset(ERC20_CLASS, encode(mockERC20_2.address), takeAmount),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), makeAmount),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodeDataRight
            )
            return {leftOrder, rightOrder}
        }

        it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties", async () => {
            const {leftOrder, rightOrder} = await gen721DV1_20rders(2000)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(await oasesExchange.getFilledRecords(
                await mockOrderLibrary.getHashKey(leftOrder)),
                1
            )

            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 100 - 3 - 1 - 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 100)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
        })

        it("From erc20(NO DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties", async () => {
            const {leftOrder, rightOrder} = await gen721DV1_20rders(2000)

            await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                EMPTY_DATA,
                await getSignature(leftOrder, accounts[1]),
                {from: accounts[2]}
            )

            assert.equal(await oasesExchange.getFilledRecords(
                await mockOrderLibrary.getHashKey(rightOrder)),
                100
            )

            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 100 - 3 - 1 - 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 100)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
        })

        async function gen721DV1_20rders(amount20) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC20_2.mint(accounts[2], amount20)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, amount20, {from: accounts[2]})
            const addOriginLeft = [[accounts[3], 100], [accounts[4], 200]]
            const encodedDataLeft = await encodeDataV1([[[accounts[5], 10000]], addOriginLeft, true])
            const encodedDataRight = await encodeDataV1([[], [], true])
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
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            return {leftOrder, rightOrder}
        }

        it("From erc20(DataV1) to erc1155(DataV1, Royalties) Protocol, Origin fees, Royalties", async () => {
            const {leftOrder, rightOrder} = await gen20DV1_1155V1Orders(3000, 100)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                "0x",
                {from: accounts[2]})

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)
            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 7)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 3000 - 1000 - 40 - 30)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 0)

            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 30)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 40)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 50)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 100)
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 50)
            assert.equal(await mockERC20_1.balanceOf(accounts[8]), 0)
            assert.equal(await mockERC20_1.balanceOf(accounts[9]), 1000 - 30 - 50 - 100 - 50 + 30)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[8], erc1155TokenId_2), 7)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 7)
        })

        it("From erc1155(DataV1, Royalties) to erc20(DataV1) Protocol, Origin fees, Royalties", async () => {
            const {leftOrder, rightOrder} = await gen20DV1_1155V1Orders(3000, 100)

            await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                EMPTY_DATA,
                await getSignature(leftOrder, accounts[1]),
                {from: accounts[2]})

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)
            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 7)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 3000 - 1000 - 40 - 30)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 0)

            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 30)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 40)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 50)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 100)
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 50)
            assert.equal(await mockERC20_1.balanceOf(accounts[8]), 0)
            assert.equal(await mockERC20_1.balanceOf(accounts[9]), 1000 - 30 - 50 - 100 - 50 + 30)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[8], erc1155TokenId_2), 7)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 7)
        })

        async function gen20DV1_1155V1Orders(amount20, amount1155) {
            await mockERC20_1.mint(accounts[1], amount20)
            await mockERC1155.mint(accounts[2], erc1155TokenId_2, amount1155)
            await mockERC20_1.approve(mockERC20TransferProxy.address, amount20, {from: accounts[1]})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[2]})

            const addOriginLeft = [[accounts[3], 300], [accounts[4], 400]]
            const addOriginRight = [[accounts[5], 500]]

            const encodedDataLeft = await encodeDataV1([[[accounts[8], 10000]], addOriginLeft, true])
            const encodedDataRight = await encodeDataV1([[[accounts[9], 10000]], addOriginRight, true])

            //set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC1155.address, [[accounts[6], 1000], [accounts[7], 500]])
            await oasesExchange.setFeeReceiver(mockERC20_1.address, protocolFeeReceiver)
            const leftOrder = Order(
                accounts[1],
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 1000),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 7),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[2],
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 7),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 1000),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            return {leftOrder, rightOrder}
        }

        it("From eth(DataV1) to erc721(Royalties, DataV1) Protocol, Origin fees, Royalties", async () => {
            const {leftOrder, rightOrder} = await genETHDV1_721V1Orders(1000)
            let signatureRight = await getSignature(rightOrder, accounts[1])

            await verifyBalanceChange(accounts[2], 50 + 60 + 1000, async () =>
                verifyBalanceChange(accounts[1], -(1000 - 30 - 70 - 100 - 50), async () =>
                    verifyBalanceChange(accounts[3], -50, async () =>
                        verifyBalanceChange(accounts[4], -60, async () =>
                            verifyBalanceChange(accounts[5], -70, async () =>
                                verifyBalanceChange(accounts[6], -100, async () =>
                                    verifyBalanceChange(accounts[7], -50, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -30, () =>
                                            oasesExchange.matchOrders(
                                                leftOrder,
                                                rightOrder,
                                                EMPTY_DATA,
                                                signatureRight,
                                                {
                                                    from: accounts[2],
                                                    value: 2000,
                                                    gasPrice: 0
                                                })
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )

            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From erc721(Royalties, DataV1) to eth(DataV1) to  Protocol, Origin fees, Royalties", async () => {
            const {leftOrder, rightOrder} = await genETHDV1_721V1Orders(1000)
            let signatureRight = await getSignature(rightOrder, accounts[1])

            await verifyBalanceChange(accounts[2], 50 + 60 + 1000, async () =>
                verifyBalanceChange(accounts[1], -(1000 - 30 - 70 - 100 - 50), async () =>
                    verifyBalanceChange(accounts[3], -50, async () =>
                        verifyBalanceChange(accounts[4], -60, async () =>
                            verifyBalanceChange(accounts[5], -70, async () =>
                                verifyBalanceChange(accounts[6], -100, async () =>
                                    verifyBalanceChange(accounts[7], -50, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -30, () =>
                                            oasesExchange.matchOrders(
                                                rightOrder,
                                                leftOrder,
                                                signatureRight,
                                                EMPTY_DATA,
                                                {
                                                    from: accounts[2],
                                                    value: 2000,
                                                    gasPrice: 0
                                                })
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )

            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        async function genETHDV1_721V1Orders(amountEth) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[3], 500], [accounts[4], 600]]
            let addOriginRight = [[accounts[5], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            // //set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC721.address, [[accounts[6], 1000], [accounts[7], 500]])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, amountEth),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, amountEth),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            return {leftOrder, rightOrder}
        }

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        leftOrder,
                                        rightOrder,
                                        EMPTY_DATA,
                                        signatureRight,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        rightOrder,
                                        leftOrder,
                                        signatureRight,
                                        EMPTY_DATA,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 10 - 12 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        leftOrder,
                                        rightOrder,
                                        EMPTY_DATA,
                                        signatureRight,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 10 - 12 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        rightOrder,
                                        leftOrder,
                                        signatureRight,
                                        EMPTY_DATA,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
        })

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12 + 14, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        leftOrder,
                                        rightOrder,
                                        EMPTY_DATA,
                                        signatureRight,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12 + 14, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        leftOrder,
                                        rightOrder,
                                        EMPTY_DATA,
                                        signatureRight,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[2])
        })

        it("From eth(DataV1) to erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB!!! not enough eth", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // 200*(5%+6%+7%+30%)=96
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            await expectThrow(
                oasesExchange.matchOrders(
                    rightOrder,
                    leftOrder,
                    await getSignature(rightOrder, accounts[1]),
                    EMPTY_DATA,
                    {
                        from: accounts[2],
                        // total payment:200+96
                        value: 295,
                        gasPrice: 0
                    }),
                "bad eth transfer"
            )
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB!!! not enough eth", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // 200*(5%+6%+7%+30%)=96
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    EMPTY_DATA,
                    await getSignature(rightOrder, accounts[1]),
                    {
                        from: accounts[2],
                        // total payment:200+96
                        value: 295,
                        gasPrice: 0
                    }),
                "bad eth transfer"
            )
        })

        it("From eth(DataV1) to erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB!!! not enough ETH for lastOrigin and seller!", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = []
            // 200*(90%+5%+6%+7%)=200*108%
            let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, "0x", 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])

            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], 0, async () =>				//200 - 6(seller protocol fee) - 180 - 10 - 12(really 4) - 14(really 0) origin left
                    verifyBalanceChange(accounts[3], -180, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -4, async () =>
                                verifyBalanceChange(accounts[7], 0, async () =>
                                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                        oasesExchange.matchOrders(
                                            leftOrder,
                                            rightOrder,
                                            EMPTY_DATA,
                                            signatureRight,
                                            {
                                                from: accounts[2],
                                                value: 300,
                                                gasPrice: 0
                                            })
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB!!! not enough eth for lastOrigin and seller!", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = []
            // 200*(90%+5%+6%+7%)=200*108%
            let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, "0x", 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])

            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], 0, async () =>				//200 - 6(seller protocol fee) - 180 - 10 - 12(really 4) - 14(really 0) origin left
                    verifyBalanceChange(accounts[3], -180, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -4, async () =>
                                verifyBalanceChange(accounts[7], 0, async () =>
                                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                        oasesExchange.matchOrders(
                                            rightOrder,
                                            leftOrder,
                                            signatureRight,
                                            EMPTY_DATA,
                                            {
                                                from: accounts[2],
                                                value: 300,
                                                gasPrice: 0
                                            })
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })
    })

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

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000 - 100 - 1)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), (100 - 3 - 2) * 0.2)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), (100 - 3 - 2) * 0.8)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200 * 0.5)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 200 * 0.5)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 200)
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 3)
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
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
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
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
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

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 5000], [accounts[3], 5000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[3], -(200 - 6 - 14) / 2, async () =>
                    verifyBalanceChange(accounts[1], -(200 - 6 - 14) / 2, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -12, async () =>
                                verifyBalanceChange(accounts[7], -14, async () =>
                                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                        oasesExchange.matchOrders(
                                            leftOrder,
                                            rightOrder,
                                            EMPTY_DATA,
                                            signatureRight,
                                            {
                                                from: accounts[2],
                                                value: 300,
                                                gasPrice: 0
                                            })
                                    )
                                )
                            )
                        )
                    )
                )
            )

            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)),
                200
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)),
                1
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 5000], [accounts[3], 5000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[3], -(200 - 6 - 14) / 2, async () =>
                    verifyBalanceChange(accounts[1], -(200 - 6 - 14) / 2, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -12, async () =>
                                verifyBalanceChange(accounts[7], -14, async () =>
                                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                        oasesExchange.matchOrders(
                                            rightOrder,
                                            leftOrder,
                                            signatureRight,
                                            EMPTY_DATA,
                                            {
                                                from: accounts[2],
                                                value: 300,
                                                gasPrice: 0
                                            })
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)),
                200
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)),
                1
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: empty 100% to order.maker", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        leftOrder,
                                        rightOrder,
                                        EMPTY_DATA,
                                        signatureRight,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)),
                200
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)),
                1
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, payouts: empty 100% to order.maker", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                    oasesExchange.matchOrders(
                                        rightOrder,
                                        leftOrder,
                                        signatureRight,
                                        EMPTY_DATA,
                                        {
                                            from: accounts[2],
                                            value: 300,
                                            gasPrice: 0
                                        })
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)),
                200
            )
            assert.equal(
                await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)),
                1
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })
    })

    describe("catch emit event Transfer", () => {
        it("From eth(DataV1) to erc721(DataV1) Protocol, check emit events", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const seller2 = accounts[3]
            const sellerRoyalty = accounts[4]
            const originLeft1 = accounts[5]
            const originLeft2 = accounts[6]
            const originRight = accounts[7]

            await mockERC721.mint(seller, erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            // set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC721.address, [[sellerRoyalty, 1000]])

            let addOriginLeft = [[originLeft1, 500], [originLeft2, 600]]
            let addOriginRight = [[originRight, 700]]
            let encodedDataLeft = await encodeDataV1([[[buyer, 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[seller, 5000], [seller2, 5000]], addOriginRight, true])

            const leftOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )

            const rightOrder = Order(
                seller,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, seller)
            let tx = await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                EMPTY_DATA,
                signatureRight,
                {
                    from: buyer,
                    value: 300,
                    gasPrice: 0
                })
            let errorCounter = 0

            truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
                switch (ev.to) {
                    case protocolFeeReceiver:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PROTOCOL_FEE)) {
                            console.log("Error in protocolFeeReceiver check:")
                            errorCounter++
                        }
                        break
                    case seller:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller check:")
                            errorCounter++
                        }
                        break
                    case seller2:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller2 check:")
                            errorCounter++
                        }
                        break
                    case originLeft1:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft1 check:")
                            errorCounter++
                        }
                        break
                    case originLeft2:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft2 check:")
                            errorCounter++
                        }
                        break
                    case originRight:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originRight check:")
                            errorCounter++
                        }
                        break
                    case sellerRoyalty:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != ROYALTY)) {
                            console.log("Error in royalty check:")
                            errorCounter++
                        }
                        break
                    case buyer:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in buyer check:")
                            errorCounter++
                        }
                        break
                }
                let result
                if (errorCounter > 0) {
                    result = false
                } else {
                    result = true
                }
                return result
            }, "Transfer should be emitted with correct parameters ")

            assert.equal(errorCounter, 0)
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, check emit events", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const seller2 = accounts[3]
            const sellerRoyalty = accounts[4]
            const originLeft1 = accounts[5]
            const originLeft2 = accounts[6]
            const originRight = accounts[7]

            await mockERC721.mint(seller, erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            // set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC721.address, [[sellerRoyalty, 1000]])

            let addOriginLeft = [[originLeft1, 500], [originLeft2, 600]]
            let addOriginRight = [[originRight, 700]]
            let encodedDataLeft = await encodeDataV1([[[buyer, 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[seller, 5000], [seller2, 5000]], addOriginRight, true])

            const leftOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )

            const rightOrder = Order(
                seller,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, seller)
            let tx = await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                signatureRight,
                EMPTY_DATA,
                {
                    from: buyer,
                    value: 300,
                    gasPrice: 0
                })
            let errorCounter = 0

            truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
                switch (ev.to) {
                    case protocolFeeReceiver:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PROTOCOL_FEE)) {
                            console.log("Error in protocolFeeReceiver check:")
                            errorCounter++
                        }
                        break
                    case seller:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller check:")
                            errorCounter++
                        }
                        break
                    case seller2:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller2 check:")
                            errorCounter++
                        }
                        break
                    case originLeft1:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft1 check:")
                            errorCounter++
                        }
                        break
                    case originLeft2:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft2 check:")
                            errorCounter++
                        }
                        break
                    case originRight:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originRight check:")
                            errorCounter++
                        }
                        break
                    case sellerRoyalty:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != ROYALTY)) {
                            console.log("Error in royalty check:")
                            errorCounter++
                        }
                        break
                    case buyer:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in buyer check:")
                            errorCounter++
                        }
                        break
                }
                let result
                if (errorCounter > 0) {
                    result = false
                } else {
                    result = true
                }
                return result
            }, "Transfer should be emitted with correct parameters")

            assert.equal(errorCounter, 0)
        })

        it("From erc1155(DataV1) to eth(DataV1) Protocol, check emit events", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const seller2 = accounts[3]
            const sellerRoyalty = accounts[4]
            const originLeft1 = accounts[5]
            const originLeft2 = accounts[6]
            const originRight = accounts[7]

            await mockERC1155.mint(seller, erc1155TokenId_1, 10)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})
            // set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC1155.address, erc1155TokenId_1, [[sellerRoyalty, 1000]])

            let addOriginLeft = [[originLeft1, 500], [originLeft2, 600]]
            let addOriginRight = [[originRight, 700]]
            let encodedDataLeft = await encodeDataV1([[[seller, 5000], [seller2, 5000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[buyer, 10000]], addOriginRight, true])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 5),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 5),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, buyer);
            let tx = await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                EMPTY_DATA,
                signatureRight,
                {
                    from: seller,
                    value: 300,
                    gasPrice: 0
                })
            let errorCounter = 0
            truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
                switch (ev.to) {
                    case communityAddress:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PROTOCOL_FEE)) {
                            console.log("Error in protocol check:")
                            errorCounter++
                        }
                        break
                    case seller:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller check:")
                            errorCounter++
                        }
                        break
                    case sellerRoyalty:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != ROYALTY)) {
                            console.log("Error in seller check:")
                            errorCounter++
                        }
                        break
                    case seller2:
                        if ((ev.direction != TO_MAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller2 check:")
                            errorCounter++
                        }
                        break
                    case originLeft1:
                        if ((ev.direction != TO_MAKER_DIRECTION) && (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft1 check:")
                            errorCounter++
                        }
                        break
                    case originLeft2:
                        if ((ev.direction != TO_MAKER_DIRECTION) && (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft2 check:")
                            errorCounter++
                        }
                        break
                    case originRight:
                        if ((ev.direction != TO_MAKER_DIRECTION) && (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originRight check:")
                            errorCounter++
                        }
                        break
                    case buyer:
                        if ((ev.direction != TO_TAKER_DIRECTION) && (ev.transferType != PAYMENT)) {
                            console.log("Error in buyer check:")
                            errorCounter++
                        }
                        break
                }
                let result
                if (errorCounter > 0) {
                    result = false
                } else {
                    result = true
                }
                return result
            }, "Transfer should be emitted with correct parameters")
            assert.equal(errorCounter, 0)
        })

        it("From eth(DataV1) to erc1155(DataV1) Protocol, check emit events", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const seller2 = accounts[3]
            const sellerRoyalty = accounts[4]
            const originLeft1 = accounts[5]
            const originLeft2 = accounts[6]
            const originRight = accounts[7]

            await mockERC1155.mint(seller, erc1155TokenId_1, 10)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})
            // set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC1155.address, erc1155TokenId_1, [[sellerRoyalty, 1000]])

            let addOriginLeft = [[originLeft1, 500], [originLeft2, 600]]
            let addOriginRight = [[originRight, 700]]
            let encodedDataLeft = await encodeDataV1([[[seller, 5000], [seller2, 5000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[buyer, 10000]], addOriginRight, true])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 5),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 5),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, buyer);
            let tx = await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                signatureRight,
                EMPTY_DATA,
                {
                    from: seller,
                    value: 300,
                    gasPrice: 0
                })
            let errorCounter = 0
            truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
                switch (ev.to) {
                    case communityAddress:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PROTOCOL_FEE)) {
                            console.log("Error in protocol check:")
                            errorCounter++
                        }
                        break
                    case seller:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller check:")
                            errorCounter++
                        }
                        break
                    case sellerRoyalty:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != ROYALTY)) {
                            console.log("Error in seller check:")
                            errorCounter++
                        }
                        break
                    case seller2:
                        if ((ev.direction != TO_TAKER_DIRECTION) || (ev.transferType != PAYMENT)) {
                            console.log("Error in seller2 check:")
                            errorCounter++
                        }
                        break
                    case originLeft1:
                        if ((ev.direction != TO_TAKER_DIRECTION) && (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft1 check:")
                            errorCounter++
                        }
                        break
                    case originLeft2:
                        if ((ev.direction != TO_TAKER_DIRECTION) && (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originLeft2 check:")
                            errorCounter++
                        }
                        break
                    case originRight:
                        if ((ev.direction != TO_TAKER_DIRECTION) && (ev.transferType != ORIGIN_FEE)) {
                            console.log("Error in originRight check:")
                            errorCounter++
                        }
                        break
                    case buyer:
                        if ((ev.direction != TO_MAKER_DIRECTION) && (ev.transferType != PAYMENT)) {
                            console.log("Error in buyer check:")
                            errorCounter++
                        }
                        break
                }
                let result
                if (errorCounter > 0) {
                    result = false
                } else {
                    result = true
                }
                return result
            }, "Transfer should be emitted with correct parameters")
            assert.equal(errorCounter, 0)
        })
    })

    describe("exchange with royalties", () => {
        it("royalties by owner, token erc721 to eth", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC721.address, [[accounts[3], 500], [accounts[4], 1000]])

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14 - 10 - 20), async () =>				//200 -6seller - 14 originright
                    verifyBalanceChange(accounts[3], -10, async () =>
                        verifyBalanceChange(accounts[4], -20, async () =>
                            verifyBalanceChange(accounts[5], -10, async () =>
                                verifyBalanceChange(accounts[6], -12, async () =>
                                    verifyBalanceChange(accounts[7], -14, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                            oasesExchange.matchOrders(
                                                leftOrder,
                                                rightOrder,
                                                EMPTY_DATA,
                                                signatureRight,
                                                {
                                                    from: accounts[2],
                                                    value: 300,
                                                    gasPrice: 0
                                                }
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("royalties by owner, eth to token erc721", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // set royalties by token
            await mockRoyaltiesRegistry.setRoyaltiesByToken(mockERC721.address, [[accounts[3], 500], [accounts[4], 1000]])

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14 - 10 - 20), async () =>				//200 -6seller - 14 originright
                    verifyBalanceChange(accounts[3], -10, async () =>
                        verifyBalanceChange(accounts[4], -20, async () =>
                            verifyBalanceChange(accounts[5], -10, async () =>
                                verifyBalanceChange(accounts[6], -12, async () =>
                                    verifyBalanceChange(accounts[7], -14, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                            oasesExchange.matchOrders(
                                                rightOrder,
                                                leftOrder,
                                                signatureRight,
                                                EMPTY_DATA,
                                                {
                                                    from: accounts[2],
                                                    value: 300,
                                                    gasPrice: 0
                                                }
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("royalties(token and tokenId) by owner, erc721 to eth", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // set royalties by token and tokenId
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(
                mockERC721.address,
                erc721TokenId_1,
                [[accounts[3], 500], [accounts[4], 1000]]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14 - 10 - 20), async () =>
                    verifyBalanceChange(accounts[3], -10, async () =>
                        verifyBalanceChange(accounts[4], -20, async () =>
                            verifyBalanceChange(accounts[5], -10, async () =>
                                verifyBalanceChange(accounts[6], -12, async () =>
                                    verifyBalanceChange(accounts[7], -14, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                            oasesExchange.matchOrders(
                                                leftOrder,
                                                rightOrder,
                                                EMPTY_DATA,
                                                signatureRight,
                                                {
                                                    from: accounts[2],
                                                    value: 300,
                                                    gasPrice: 0
                                                })
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })

        it("royalties(token and tokenId) by owner, eth to erc721", async () => {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // set royalties by token and tokenId
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(
                mockERC721.address,
                erc721TokenId_1,
                [[accounts[3], 500], [accounts[4], 1000]]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[1], -(200 - 6 - 14 - 10 - 20), async () =>
                    verifyBalanceChange(accounts[3], -10, async () =>
                        verifyBalanceChange(accounts[4], -20, async () =>
                            verifyBalanceChange(accounts[5], -10, async () =>
                                verifyBalanceChange(accounts[6], -12, async () =>
                                    verifyBalanceChange(accounts[7], -14, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -6, () =>
                                            oasesExchange.matchOrders(
                                                rightOrder,
                                                leftOrder,
                                                signatureRight,
                                                EMPTY_DATA,
                                                {
                                                    from: accounts[2],
                                                    value: 300,
                                                    gasPrice: 0
                                                })
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
        })
    })

    describe("matchOrders, orderType = V1", () => {
        it("should correctly calculate make-side fill for isMakeFill = true, eth to erc1155", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const buyer1 = accounts[3]

            await mockERC1155.mint(seller, erc1155TokenId_1, 200)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const encodedDataLeft = await encodeDataV1([[], [], true])
            const encodedDataRight = await encodeDataV1([[], [], false])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 200),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 1000),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureLeft = await getSignature(leftOrder, seller)
            // right order full filled —— 500eth(total amount) 3% protocol fee
            await verifyBalanceChange(seller, -(500 * (1 - 0.03)), async () =>
                verifyBalanceChange(buyer, 500, async () =>
                    oasesExchange.matchOrders(
                        rightOrder,
                        leftOrder,
                        EMPTY_DATA,
                        signatureLeft,
                        {
                            from: buyer,
                            value: 600,
                            gasPrice: 0
                        }
                    )
                )
            )
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 100)

            const leftOrderHash = await mockOrderLibrary.getHashKey(leftOrder)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                100,
            )

            const rightOrder2 = Order(
                buyer1,
                Asset(ETH_CLASS, EMPTY_DATA, 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            // right order full filled —— 500eth(total amount) 3% protocol fee
            await verifyBalanceChange(seller, -(500 * (1 - 0.03)), async () =>
                verifyBalanceChange(buyer1, 500, async () =>
                    oasesExchange.matchOrders(
                        rightOrder2,
                        leftOrder,
                        EMPTY_DATA,
                        signatureLeft,
                        {
                            from: buyer1,
                            value: 600,
                            gasPrice: 0
                        })
                )
            )
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                200,
            )

            assert.equal(await mockERC1155.balanceOf(buyer1, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 0)
        })

        it("should correctly calculate make-side fill for isMakeFill = true, erc1155 to eth", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const buyer1 = accounts[3]

            await mockERC1155.mint(seller, erc1155TokenId_1, 200)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const encodedDataLeft = await encodeDataV1([[], [], true])
            const encodedDataRight = await encodeDataV1([[], [], false])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 200),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 1000),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureLeft = await getSignature(leftOrder, seller)
            // right order full filled —— 500eth(total amount) 3% protocol fee
            await verifyBalanceChange(seller, -(500 * (1 - 0.03)), async () =>
                verifyBalanceChange(buyer, 500, async () =>
                    oasesExchange.matchOrders(
                        leftOrder,
                        rightOrder,
                        signatureLeft,
                        EMPTY_DATA,
                        {
                            from: buyer,
                            value: 600,
                            gasPrice: 0
                        }
                    )
                )
            )
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 100)

            const leftOrderHash = await mockOrderLibrary.getHashKey(leftOrder)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                100,
            )

            const rightOrder2 = Order(
                buyer1,
                Asset(ETH_CLASS, EMPTY_DATA, 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            // right order full filled —— 500eth(total amount) 3% protocol fee
            await verifyBalanceChange(seller, -(500 * (1 - 0.03)), async () =>
                verifyBalanceChange(buyer1, 500, async () =>
                    oasesExchange.matchOrders(
                        leftOrder,
                        rightOrder2,
                        signatureLeft,
                        EMPTY_DATA,
                        {
                            from: buyer1,
                            value: 600,
                            gasPrice: 0
                        })
                )
            )
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                200,
            )

            assert.equal(await mockERC1155.balanceOf(buyer1, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 0)
        })

        it("should correctly calculate take-side fill for isMakeFill = false, erc1155 to eth", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const buyer1 = accounts[3]

            await mockERC1155.mint(seller, erc1155TokenId_1, 200)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const encodedDataLeft = await encodeDataV1([[], [], false])
            const encodedDataRight = await encodeDataV1([[], [], false])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 200),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 1000),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, "0x", 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureLeft = await getSignature(leftOrder, seller)
            // right order full filled —— 500eth(total amount) 3% protocol fee
            await verifyBalanceChange(seller, -485, async () =>
                verifyBalanceChange(buyer, 500, async () =>
                    oasesExchange.matchOrders(
                        leftOrder,
                        rightOrder,
                        signatureLeft,
                        EMPTY_DATA,
                        {
                            from: buyer,
                            value: 600,
                            gasPrice: 0
                        })
                )
            )
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 100)

            const leftOrderHash = await mockOrderLibrary.getHashKey(leftOrder)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                500
            )

            const rightOrder1 = Order(
                buyer1,
                Asset(ETH_CLASS, "0x", 1000),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            await verifyBalanceChange(seller, -485, async () =>
                verifyBalanceChange(buyer1, 500, async () =>
                    oasesExchange.matchOrders(
                        leftOrder,
                        rightOrder1,
                        signatureLeft,
                        EMPTY_DATA,
                        {
                            from: buyer1,
                            value: 1100,
                            gasPrice: 0
                        })
                )
            )

            assert.equal(await mockERC1155.balanceOf(buyer1, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 0)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                1000
            )
        })

        it("should correctly calculate take-side fill for isMakeFill = false, eth to erc1155", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const buyer1 = accounts[3]

            await mockERC1155.mint(seller, erc1155TokenId_1, 200)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const encodedDataLeft = await encodeDataV1([[], [], false])
            const encodedDataRight = await encodeDataV1([[], [], false])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 200),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 1000),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, "0x", 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureLeft = await getSignature(leftOrder, seller)
            // right order full filled —— 500eth(total amount) 3% protocol fee
            await verifyBalanceChange(seller, -485, async () =>
                verifyBalanceChange(buyer, 500, async () =>
                    oasesExchange.matchOrders(
                        rightOrder,
                        leftOrder,
                        EMPTY_DATA,
                        signatureLeft,
                        {
                            from: buyer,
                            value: 600,
                            gasPrice: 0
                        })
                )
            )
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 100)

            const leftOrderHash = await mockOrderLibrary.getHashKey(leftOrder)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                500
            )

            const rightOrder1 = Order(
                buyer1,
                Asset(ETH_CLASS, "0x", 1000),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            // market price deal
            await verifyBalanceChange(seller, -485, async () =>
                verifyBalanceChange(buyer1, 500, async () =>
                    oasesExchange.matchOrders(
                        rightOrder1,
                        leftOrder,
                        EMPTY_DATA,
                        signatureLeft,
                        {
                            from: buyer1,
                            value: 1100,
                            gasPrice: 0
                        })
                )
            )

            assert.equal(await mockERC1155.balanceOf(buyer1, erc1155TokenId_1), 50)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 50)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                1000
            )
        })

        it("should correctly calculate make-side fill for isMakeFill = true and originFees", async () => {
            const seller = accounts[1]
            const buyer = accounts[2]
            const buyer1 = accounts[3]

            await mockERC1155.mint(seller, erc1155TokenId_1, 200)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const encodedDataLeft = await encodeDataV1([[[seller, 10000]], [[accounts[5], 1000]], true])
            const encodedDataRight = await encodeDataV1([[], [], false])

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 200),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 1000),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                buyer,
                Asset(ETH_CLASS, "0x", 500),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureLeft = await getSignature(leftOrder, seller)
            await verifyBalanceChange(seller, -(500 - 15 - 50), async () =>
                verifyBalanceChange(buyer, 500, async () =>
                    verifyBalanceChange(accounts[5], -50, async () =>
                        oasesExchange.matchOrders(
                            leftOrder,
                            rightOrder,
                            signatureLeft,
                            EMPTY_DATA,
                            {
                                from: buyer,
                                value: 600,
                                gasPrice: 0
                            }
                        )
                    )
                )
            )
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 100)

            const leftOrderHash = await mockOrderLibrary.getHashKey(leftOrder)
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                100
            )

            const rightOrder1 = Order(
                buyer1,
                Asset(ETH_CLASS, EMPTY_DATA, 1000),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            await verifyBalanceChange(seller, -(500 - 15 - 50), async () =>
                verifyBalanceChange(buyer1, 500, async () =>
                    verifyBalanceChange(accounts[5], -50, async () =>
                        oasesExchange.matchOrders(
                            leftOrder,
                            rightOrder1,
                            signatureLeft,
                            EMPTY_DATA,
                            {
                                from: buyer1,
                                value: 600,
                                gasPrice: 0
                            })
                    )
                )
            )
            assert.equal(
                await oasesExchange.getFilledRecords(leftOrderHash),
                200
            )
            assert.equal(await mockERC1155.balanceOf(buyer1, erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(seller, erc1155TokenId_1), 0)
        })
    })

    function encodeDataV1(tuple) {
        return mockOasesCashierManager.encodeDataV1(tuple)
    }

    async function getSignature(order, signer) {
        return sign(order, signer, oasesExchange.address)
    }
})
