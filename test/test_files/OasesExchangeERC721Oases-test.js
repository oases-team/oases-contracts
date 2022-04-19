const {deployProxy} = require('@openzeppelin/truffle-upgrades')
const truffleAssert = require('truffle-assertions')
const MockERC721LazyMintTransferProxy = artifacts.require("ERC721LazyMintTransferProxy.sol")
const OasesExchange = artifacts.require("OasesExchange.sol")
const ERC721Oases = artifacts.require("ERC721Oases.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const MockRoyaltiesRegistry = artifacts.require("MockRoyaltiesRegistry.sol")
const MockOasesCashierManager = artifacts.require("MockOasesCashierManager.sol")
const MockOrderLibrary = artifacts.require("MockOrderLibrary.sol")

const {Order, Asset, sign, EMPTY_DATA, ORDER_V1_DATA_TYPE} = require("./types/order")
const mint = require("./utils/mint")

const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_FLAG_ADDRESS = ZERO_ADDRESS
const {
    encodeERC721LazyMintData,
    encode,
    ETH_CLASS,
    ERC20_CLASS,
    TO_MAKER_DIRECTION,
    TO_TAKER_DIRECTION,
    PROTOCOL_FEE,
    ROYALTY,
    ORIGIN_FEE,
    PAYMENT,
    ERC721_LAZY_MINT_CLASS
} = require("./types/assets")

contract("test OasesExchange.sol (protocol fee 3% —— seller 3%)", accounts => {
    const TOKEN_ID = accounts[0] + '000000000000000000000001'
    const TOKEN_URI = 'test tokenURI'

    const protocolFeeReceiver = accounts[9]
    const communityAddress = accounts[8]

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
    let mockERC721LazyMintTransferProxy
    let erc721Oases

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
        await oasesExchange.setFeeReceiver(ETH_FLAG_ADDRESS, protocolFeeReceiver)

        // utils
        mockOasesCashierManager = await MockOasesCashierManager.new()
        mockOrderLibrary = await MockOrderLibrary.new()
        mockERC721LazyMintTransferProxy = await MockERC721LazyMintTransferProxy.new()
        await mockERC721LazyMintTransferProxy.__Operators_init()
        await mockERC721LazyMintTransferProxy.addOperator(oasesExchange.address)
        await oasesExchange.setTransferProxy(ERC721_LAZY_MINT_CLASS, mockERC721LazyMintTransferProxy.address)

        // ERC20
        mockERC20_1 = await MockERC20.new()
        mockERC20_2 = await MockERC20.new()
        // ERC721
        mockERC721 = await MockERC721.new()
        // ERC1155
        mockERC1155 = await MockERC1155.new()
        // ERC721 Oases
        erc721Oases = await deployProxy(
            ERC721Oases,
            [
                'oases',
                'OAS',
                "test baseURI",
                "test contractURI",
                mockNFTTransferProxy.address,
                mockERC721LazyMintTransferProxy.address
            ],
            {
                initializer: "__ERC721Oases_init"
            }
        )
    })

    function getPartsWithName(list) {
        return list.map(member => ({account: member[0], value: member[1]}))
    }

    function getSignatureForLazyMintData(tokenId, tokenURI, creatorsInfo, royaltiesInfo, signer) {
        return mint.sign(signer, tokenId, tokenURI, creatorsInfo, royaltiesInfo, erc721Oases.address)
    }

    async function getERC721OasesAsset(creatorsInfo, royaltiesInfo, signer, tokenId = TOKEN_ID, tokenURI = TOKEN_URI) {
        const signature = await getSignatureForLazyMintData(
            tokenId,
            tokenURI,
            getPartsWithName(creatorsInfo),
            getPartsWithName(royaltiesInfo),
            signer
        )
        let erc721LazyMintData = [tokenId, tokenURI, creatorsInfo, royaltiesInfo, [signature]]
        return Asset(ERC721_LAZY_MINT_CLASS, encodeERC721LazyMintData(erc721Oases.address, erc721LazyMintData), 1)
    }

    function encodeDataV1(tuple) {
        return mockOasesCashierManager.encodeDataV1(tuple)
    }

    async function getSignature(order, signer) {
        return sign(order, signer, oasesExchange.address)
    }

    describe("test cancelOrders()", () => {
        it("cancel orders", async () => {
            const erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])
            const encodedData = await encodeDataV1([[], [], true])

            const order1 = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            const order2 = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                2,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            await oasesExchange.cancelOrders([order1, order2])

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(order1)), 2 ** 256 - 1)
            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(order2)), 2 ** 256 - 1)
        })

        it("revert if right order is cancelled", async () => {
            const erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])

            const encodedDataLeft = await encodeDataV1([[], [], true])
            const encodedDataRight = await encodeDataV1([[], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )

            const signatureRight = await getSignature(rightOrder, accounts[0])
            await oasesExchange.cancelOrders([rightOrder])
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
            const erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])
            const encodedData = await encodeDataV1([[], [], true])
            const order1 = Order(
                accounts[1],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            const order2 = Order(
                accounts[0],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            await expectThrow(
                oasesExchange.cancelOrders([order1, order2], {from: accounts[1]}),
                'not the order maker'
            )
        })

        it("revert if salt in order is 0", async () => {
            const erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])
            const encodedData = await encodeDataV1([[], [], true])
            const order1 = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )
            const order2 = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                0,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData
            )

            await expectThrow(
                oasesExchange.cancelOrders([order1, order2], {from: accounts[2]}),
                'salt 0 cannot be cancelled'
            )
        })
    })

    describe("test matchOrders()", () => {
        it("eth orders work. revert when eth is not enough", async () => {
            let erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])

            const leftOrder = Order(
                accounts[1],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                    await getSignature(rightOrder, accounts[0]),
                    {
                        from: accounts[1],
                        value: 199
                    }),
                "bad eth transfer"
            )
        })

        it("eth orders work. revert with unknown data type of order", async () => {
            let erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                    await getSignature(rightOrder, accounts[0]),
                    {
                        from: accounts[2],
                        value: 300
                    }),
                "unsupported order data type"
            )
        })

        it("eth orders work. rest is returned to taker (other side)", async () => {
            let erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA)

            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA)

            const signatureRight = await getSignature(rightOrder, accounts[0])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[0], -194, async () =>
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("lazy mint erc721 to eth order maker eth != who pay, both orders have to be with signatures", async () => {
            let erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])
            const leftOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            let signatureLeft = await getSignature(leftOrder, accounts[0])
            let signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[0], -194, async () =>
                    verifyBalanceChange(protocolFeeReceiver, -6, () =>
                        // NB! from: accounts[2] - who pay for NFT != order Maker
                        oasesExchange.matchOrders(
                            leftOrder,
                            rightOrder,
                            signatureLeft,
                            signatureRight,
                            {
                                from: accounts[2],
                                value: 300,
                                gasPrice: 0
                            })
                    )
                )
            )

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[1]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[1])
        })

        it("lazy mint erc721 to eth order maker eth != who pay, eth orders have no signature, revert", async () => {
            let erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])

            const leftOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            let signatureLeft = await getSignature(leftOrder, accounts[0])
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

        it("lazy mint erc721 to eth with wrong lazy-mint signature, revert", async () => {
            // wrong signature
            let erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[1])
            const leftOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            const rightOrder = Order(
                accounts[1],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )

            let signatureLeft = await getSignature(leftOrder, accounts[0])
            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    signatureLeft,
                    EMPTY_DATA,
                    {
                        from: accounts[1],
                        value: 300,
                        gasPrice: 0
                    }
                ),
                "signature verification error"
            )
        })
    })

    describe("test matchOrders() with orders dataType == V1", () => {
        it("From lazy mint erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties", async () => {
            const {leftOrder, rightOrder} = await genLM721DV1_20Orders(2000)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[0]),
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
        })

        it("From erc20(NO DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees, no Royalties", async () => {
            const {leftOrder, rightOrder} = await genLM721DV1_20Orders(2000)

            await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                EMPTY_DATA,
                await getSignature(leftOrder, accounts[0]),
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
        })

        async function genLM721DV1_20Orders(amount20) {
            const erc721OasesAsset = await getERC721OasesAsset([[accounts[0], 10000]], [], accounts[0])
            await mockERC20_2.mint(accounts[2], amount20)
            await mockERC20_2.approve(mockERC20TransferProxy.address, amount20, {from: accounts[2]})
            const addOriginLeft = [[accounts[3], 100], [accounts[4], 200]]
            const encodedDataLeft = await encodeDataV1([[[accounts[5], 10000]], addOriginLeft, true])
            const encodedDataRight = await encodeDataV1([[], [], true])
            const leftOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            return {leftOrder, rightOrder}
        }

        it("From eth(DataV1) to lazy mint erc721(Royalties, DataV1) Protocol, Origin fees, Royalties", async () => {
            const {leftOrder, rightOrder} = await genETHDV1_LM721V1Orders(1000)
            let signatureRight = await getSignature(rightOrder, accounts[0])

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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(Royalties, DataV1) to eth(DataV1) Protocol, Origin fees, Royalties", async () => {
            const {leftOrder, rightOrder} = await genETHDV1_LM721V1Orders(1000)
            let signatureRight = await getSignature(rightOrder, accounts[0])

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

            assert.equal(await erc721Oases.balanceOf(accounts[1]), 0)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        async function genETHDV1_LM721V1Orders(amountEth) {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]],
                [[accounts[6], 1000], [accounts[7], 500]],
                accounts[0]
            )

            let addOriginLeft = [[accounts[3], 500], [accounts[4], 600]]
            let addOriginRight = [[accounts[5], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, amountEth),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
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

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees, no Royalties", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("revert if lazy mint erc721 order's maker is not the minter of the token(the head address in token id)", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[1],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[1])
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
                    })
                ,
                "from not minter"
            )

        })

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB!!! not enough eth", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )
            // 200*(5%+6%+7%+30%)=96
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                    await getSignature(rightOrder, accounts[0]),
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

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB!!! not enough eth", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )
            // 200*(5%+6%+7%+30%)=96
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                    await getSignature(rightOrder, accounts[0]),
                    {
                        from: accounts[2],
                        // total payment:200+96
                        value: 295,
                        gasPrice: 0
                    }),
                "bad eth transfer"
            )
        })

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB!!! not enough ETH for lastOrigin and seller!", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = []
            // 200*(90%+5%+6%+7%)=200*108%
            let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, "0x", 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])

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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB!!! not enough eth for lastOrigin and seller!", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = []
            // 200*(90%+5%+6%+7%)=200*108%
            let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, "0x", 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])

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

            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })
    })

    describe("test matchOrders(), orders dataType == V1, multipleBeneficiary", () => {
        it("From lazy mint erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            const {leftOrder, rightOrder} = await prepareLM721DV1_20Orders(1000)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[0]),
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
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        async function prepareLM721DV1_20Orders(t2Amount) {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100], [accounts[4], 200], [accounts[5], 300]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[6], 5000]], addOriginLeft, true])
            const leftOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            return {leftOrder, rightOrder}
        }

        it("From erc20(NO DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            const {leftOrder, rightOrder} = await prepareLM721DV1_20Orders(1000)

            await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                EMPTY_DATA,
                await getSignature(leftOrder, accounts[0]),
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
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, payouts: 110%, throw", async () => {
            const {leftOrder, rightOrder} = await prepareLM721DV1_20_110CentsOrders(1000)

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    await getSignature(leftOrder, accounts[0]),
                    EMPTY_DATA,
                    {from: accounts[2]}
                ),
                "total bp of payment is not 100%"
            )
        })

        async function prepareLM721DV1_20_110CentsOrders(t2Amount) {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})

            let addOriginLeft = [[accounts[3], 100], [accounts[4], 200]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[5], 5001]], addOriginLeft, true])
            const leftOrder = Order(
                accounts[0],
                erc721OasesAsset,
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
                erc721OasesAsset,
                1,
                0,
                0,
                "0xffffffff",
                EMPTY_DATA
            )
            return {leftOrder, rightOrder}
        }

        it("From erc20(NO DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: 110%, throw", async () => {
            const {leftOrder, rightOrder} = await prepareLM721DV1_20_110CentsOrders(1000)

            await expectThrow(
                oasesExchange.matchOrders(
                    rightOrder,
                    leftOrder,
                    EMPTY_DATA,
                    await getSignature(leftOrder, accounts[0]),
                    {from: accounts[2]}
                ),
                "total bp of payment is not 100%"
            )
        })

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 5000], [accounts[3], 5000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, payouts: 50/50%", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 5000], [accounts[3], 5000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, Origin fees, no Royalties, payouts: empty 100% to order.maker", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[0], -(200 - 6 - 14), async () =>
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, payouts: empty 100% to order.maker", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [], accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                verifyBalanceChange(accounts[0], -(200 - 6 - 14), async () =>
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })
    })

    describe("catch emit event Transfer(lazy mint erc721 trade)", () => {
        it("From eth(DataV1) to lazy mint erc721(DataV1) Protocol, check emit events", async () => {
            const seller = accounts[0]
            const buyer = accounts[2]
            const seller2 = accounts[3]
            const sellerRoyalty = accounts[4]
            const originLeft1 = accounts[5]
            const originLeft2 = accounts[6]
            const originRight = accounts[7]

            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [[sellerRoyalty, 1000]], accounts[0]
            )

            let addOriginLeft = [[originLeft1, 500], [originLeft2, 600]]
            let addOriginRight = [[originRight, 700]]
            let encodedDataLeft = await encodeDataV1([[[buyer, 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[seller, 5000], [seller2, 5000]], addOriginRight, true])

            const leftOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )

            const rightOrder = Order(
                seller,
                erc721OasesAsset,
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

        it("From lazy mint erc721(DataV1) to eth(DataV1) Protocol, check emit events", async () => {
            const seller = accounts[0]
            const buyer = accounts[2]
            const seller2 = accounts[3]
            const sellerRoyalty = accounts[4]
            const originLeft1 = accounts[5]
            const originLeft2 = accounts[6]
            const originRight = accounts[7]

            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]], [[sellerRoyalty, 1000]], accounts[0]
            )

            let addOriginLeft = [[originLeft1, 500], [originLeft2, 600]]
            let addOriginRight = [[originRight, 700]]
            let encodedDataLeft = await encodeDataV1([[[buyer, 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[seller, 5000], [seller2, 5000]], addOriginRight, true])

            const leftOrder = Order(
                buyer,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )

            const rightOrder = Order(
                seller,
                erc721OasesAsset,
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
    })

    describe("exchange with royalties(lazy mint erc721 trade)", () => {
        it("royalties by owner, token lazy mint erc721 to eth", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]],
                [[accounts[3], 500], [accounts[4], 1000]],
                accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })

        it("royalties by owner, eth to token lazy mint erc721", async () => {
            const erc721OasesAsset = await getERC721OasesAsset(
                [[accounts[0], 10000]],
                [[accounts[3], 500], [accounts[4], 1000]],
                accounts[0]
            )

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], addOriginRight, true])

            const leftOrder = Order(
                accounts[2],
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                ZERO_ADDRESS,
                erc721OasesAsset,
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft
            )
            const rightOrder = Order(
                accounts[0],
                erc721OasesAsset,
                ZERO_ADDRESS,
                Asset(ETH_CLASS, EMPTY_DATA, 200),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            let signatureRight = await getSignature(rightOrder, accounts[0])
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
            assert.equal(await erc721Oases.balanceOf(accounts[0]), 0)
            assert.equal(await erc721Oases.balanceOf(accounts[2]), 1)
            assert.equal(await erc721Oases.ownerOf(TOKEN_ID), accounts[2])
        })
    })
})