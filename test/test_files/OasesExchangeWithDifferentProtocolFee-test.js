const {deployProxy} = require('@openzeppelin/truffle-upgrades')
const OasesExchange = artifacts.require("OasesExchange.sol")
const ProtocolFeeProvider = artifacts.require("ProtocolFeeProvider.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
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
} = require("./types/assets")
const {getRandomInteger} = require('./utils/utils')

contract("test OasesExchange.sol (default protocol fee 3% —— seller 3%)", accounts => {
    const protocolFeeReceiver = accounts[9]
    const communityAddress = accounts[8]
    const erc721TokenId_1 = getRandomInteger(0, 10000)
    const erc721TokenId_2 = erc721TokenId_1 + 1
    const erc1155TokenId_1 = getRandomInteger(0, 10000)
    const erc1155TokenId_2 = erc1155TokenId_1 + 1

    let oasesExchange
    let protocolFeeProvider
    let mockOasesCashierManager
    let memberCard
    let mockERC20_1
    let mockERC20_2
    let mockERC721
    let mockERC1155
    let mockNFTTransferProxy
    let mockERC20TransferProxy
    let mockOrderLibrary

    beforeEach(async () => {
        protocolFeeProvider = await deployProxy(
            ProtocolFeeProvider,
            [
                300
            ],
            {
                initializer: '__ProtocolFeeProvider_init'
            }
        )
        memberCard = await MockERC721.new()
        mockNFTTransferProxy = await MockNFTTransferProxy.new()
        mockERC20TransferProxy = await MockERC20TransferProxy.new()
        oasesExchange = await deployProxy(
            OasesExchange,
            [
                communityAddress,
                protocolFeeProvider.address,
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

    async function setMemberCardInfo(newMemberCardProtocolFeeBasisPoints) {
        await protocolFeeProvider.setMemberCardNFTAddress(memberCard.address)
        await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(newMemberCardProtocolFeeBasisPoints)
    }

    describe("test matchOrders() with orders dataType == V1", () => {
        it("From erc20(100) to erc20(200) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[2], 1024);
            let {leftOrder, rightOrder} = await gen2O_20Orders(11111, 22222, 1000, 200)

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 11111 - 1000 - 10)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 1000 - 30 - 20)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 10)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 20)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 22222 - 200)
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 30)

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                EMPTY_DATA,
                {from: accounts[2]}
            )

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 11111 - (1000 + 10) * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 1000 - 30 - 20 + (1000 - 24 - 20))
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 10 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 20 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 22222 - 200 * 2)
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 30 + 24)
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
            const addOriginLeft = [[accounts[3], 100]]
            const addOriginRight = [[accounts[4], 200]]
            const encodeDataLeft = await encodeDataV1([[[accounts[1], 10000]], [], addOriginLeft, true])
            const encodeDataRight = await encodeDataV1([[[accounts[2], 10000]], [], addOriginRight, true])
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

        it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            let {leftOrder, rightOrder} = await gen721DV1_20rders(2000)

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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
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

            // floor 2.4 protocol fee to 2
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 100 - 3 - 1 - 2 + (100 - 2 - 1 - 2))
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 100 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2 * 2)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.balanceOf(accounts[2]), 1)
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3 + 2)
        })

        it("From erc20(NO DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
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
            const encodedDataLeft = await encodeDataV1([[[accounts[5], 10000]], [], addOriginLeft, true])
            const encodedDataRight = await encodeDataV1([[], [], [], true])
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

        it("From erc20(DataV1) to erc1155(DataV1, Royalties) Protocol, Origin fees, Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[2], 1024);
            let {leftOrder, rightOrder} = await gen20DV1_1155V1Orders(3000, 100)

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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await oasesExchange.matchOrders(
                leftOrder,
                rightOrder,
                await getSignature(leftOrder, accounts[1]),
                "0x",
                {from: accounts[2]})

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)
            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 7)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 3000 - (1000 + 40 + 30) * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 0)

            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 30 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 40 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 50 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 100 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 50 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[8]), 0)
            assert.equal(await mockERC20_1.balanceOf(accounts[9]), 1000 - 30 - 50 - 100 - 50 + 30 + (1000 - 24 - 50 - 100 - 50 + 24))
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[8], erc1155TokenId_2), 7 * 2)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 7 * 2)
        })

        it("From erc1155(DataV1, Royalties) to erc20(DataV1) Protocol, Origin fees, Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[2], 1024);
            let {leftOrder, rightOrder} = await gen20DV1_1155V1Orders(3000, 100)

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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await oasesExchange.matchOrders(
                rightOrder,
                leftOrder,
                EMPTY_DATA,
                await getSignature(leftOrder, accounts[1]),
                {from: accounts[2]})

            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(leftOrder)), 1000)
            assert.equal(await oasesExchange.getFilledRecords(await mockOrderLibrary.getHashKey(rightOrder)), 7)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 3000 - (1000 + 40 + 30) * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 0)

            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 30 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 40 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 50 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 100 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 50 * 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[8]), 0)
            assert.equal(await mockERC20_1.balanceOf(accounts[9]), 1000 - 30 - 50 - 100 - 50 + 30 + (1000 - 24 - 50 - 100 - 50 + 24))
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[8], erc1155TokenId_2), 7 * 2)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 7 * 2)
        })

        async function gen20DV1_1155V1Orders(amount20, amount1155) {
            await mockERC20_1.mint(accounts[1], amount20)
            await mockERC1155.mint(accounts[2], erc1155TokenId_2, amount1155)
            await mockERC20_1.approve(mockERC20TransferProxy.address, amount20, {from: accounts[1]})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[2]})

            const addOriginLeft = [[accounts[3], 300], [accounts[4], 400]]
            const addOriginRight = [[accounts[5], 500]]

            const encodedDataLeft = await encodeDataV1([[[accounts[8], 10000]], [], addOriginLeft, true])
            const encodedDataRight = await encodeDataV1([[[accounts[9], 10000]], [[accounts[6], 1000], [accounts[7], 500]], addOriginRight, true])

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

        it("From eth(DataV1) to erc721(Royalties, DataV1) Protocol, Origin fees, Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            let {leftOrder, rightOrder} = await genETHDV1_721V1Orders(1000)
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 50 + 60 + 1000, async () =>
                verifyBalanceChange(accounts[1], -(1000 - 24 - 70 - 100 - 50), async () =>
                    verifyBalanceChange(accounts[3], -50, async () =>
                        verifyBalanceChange(accounts[4], -60, async () =>
                            verifyBalanceChange(accounts[5], -70, async () =>
                                verifyBalanceChange(accounts[6], -100, async () =>
                                    verifyBalanceChange(accounts[7], -50, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -24, () =>
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

        it("From erc721(Royalties, DataV1) to eth(DataV1) to  Protocol, Origin fees, Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            let {leftOrder, rightOrder} = await genETHDV1_721V1Orders(1000)
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 50 + 60 + 1000, async () =>
                verifyBalanceChange(accounts[1], -(1000 - 24 - 70 - 100 - 50), async () =>
                    verifyBalanceChange(accounts[3], -50, async () =>
                        verifyBalanceChange(accounts[4], -60, async () =>
                            verifyBalanceChange(accounts[5], -70, async () =>
                                verifyBalanceChange(accounts[6], -100, async () =>
                                    verifyBalanceChange(accounts[7], -50, async () =>
                                        verifyBalanceChange(protocolFeeReceiver, -24, () =>
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
        })

        async function genETHDV1_721V1Orders(amountEth) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[3], 500], [accounts[4], 600]]
            let addOriginRight = [[accounts[5], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [[accounts[6], 1000], [accounts[7], 500]], addOriginRight, true])

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

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], addOriginRight, true])

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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 6 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], [], true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_2, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 10 - 12 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderNFT, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginRight = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], [], true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_2, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 10 - 12 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], [], true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_2, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12 + 14, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees comes from OrderEth, no Royalties, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], [], true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_2, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12 + 14, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From eth(DataV1) to erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB, different Protocol fee(3% && 2.4%)!!! not enough eth", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // 200*(5%+6%+7%+30%)=96
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], [], true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

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

        it("From erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderEth NB, different Protocol fee(3% && 2.4%)!!! not enough eth", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            // 200*(5%+6%+7%+30%)=96
            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600], [accounts[7], 700], [accounts[3], 3000]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], [], true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

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

        it("From eth(DataV1) to erc721(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB, different Protocol fee(3% && 2.4%)!!! not enough ETH for lastOrigin and seller!", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = []
            // 200*(90%+5%+6%+7%)=200*108%
            let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], 0, async () =>				//200 - 4(seller protocol fee) - 180 - 10 - 12(really 6) - 14(really 0) origin left
                    verifyBalanceChange(accounts[3], -180, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -6, async () =>
                                verifyBalanceChange(accounts[7], 0, async () =>
                                    verifyBalanceChange(protocolFeeReceiver, -4, () =>
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
        })

        it("From erc721(DataV1) to eth(DataV1) Protocol, no Royalties, Origin fees comes from OrderNFT NB, different Protocol fee(3% && 2.4%)!!! not enough eth for lastOrigin and seller!", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = []
            // 200*(90%+5%+6%+7%)=200*108%
            let addOriginRight = [[accounts[3], 9000], [accounts[5], 500], [accounts[6], 600], [accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200, async () =>
                verifyBalanceChange(accounts[1], 0, async () =>				//200 - 4(seller protocol fee) - 180 - 10 - 12(really 6) - 14(really 0) origin left
                    verifyBalanceChange(accounts[3], -180, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -6, async () =>
                                verifyBalanceChange(accounts[7], 0, async () =>
                                    verifyBalanceChange(protocolFeeReceiver, -4, () =>
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
        it("From erc20(100) to erc20(200) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: 1)20/80%, 2)50/50%", async () => {
            await memberCard.mint(accounts[2], 1024);
            let {leftOrder, rightOrder} = await prepare20Orders(1000, 2000)

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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

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

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000 - (100 + 1) * 2)
            // floor protocol fee from 2.4 to 2 and (100 - 2 - 2) * 0.2 = 19.2 , then floor it to 19
            const amount = Math.floor((100 - 2 - 2) * 0.2)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), (100 - 3 - 2) * 0.2 + amount)
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), (100 - 3 - 2) * 0.8 + (100 - 2 - 2 - amount))
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 2)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 2 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), 200 * 0.5 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 200 * 0.5 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 2000 - 200 * 2)
            // floor protocol fee from 2.4 to 2
            assert.equal(await mockERC20_1.balanceOf(communityAddress), 3 + 2)
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 0)
        })

        async function prepare20Orders(t1Amount, t2Amount) {
            await mockERC20_1.mint(accounts[1], t1Amount)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC20_1.approve(mockERC20TransferProxy.address, t1Amount, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100]]
            let addOriginRight = [[accounts[4], 200]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[5], 5000]], [], addOriginLeft, true])
            let encodeDataRight = await encodeDataV1([[[accounts[2], 2000], [accounts[6], 8000]], [], addOriginRight, true])
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

        it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: 50/50%", async () => {
            await memberCard.mint(accounts[1], 1024);
            let {leftOrder, rightOrder} = await prepare721DV1_20Orders(1000)

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

            const amount1 = Math.floor((100 - 3 - 1 - 2 - 3) / 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), amount1)
            assert.equal(await mockERC20_2.balanceOf(accounts[6]), 100 - 3 - 1 - 2 - 3 - amount1)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
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

            // floor protocol fee from 2.4 to 2
            const amount2 = Math.floor((100 - 2 - 1 - 2 - 3) / 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), amount1 + amount2)
            assert.equal(await mockERC20_2.balanceOf(accounts[6]), 100 - 3 - 1 - 2 - 3 - amount1 + 100 - 2 - 1 - 2 - 3 - amount2)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3 * 2)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3 + 2)
        })

        async function prepare721DV1_20Orders(t2Amount) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100], [accounts[4], 200], [accounts[5], 300]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[6], 5000]], [], addOriginLeft, true])
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

        it("From erc20(NO DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: 50/50%", async () => {
            await memberCard.mint(accounts[1], 1024);
            let {leftOrder, rightOrder} = await prepare721DV1_20Orders(1000)

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

            const amount1 = Math.floor((100 - 3 - 1 - 2 - 3) / 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), amount1)
            assert.equal(await mockERC20_2.balanceOf(accounts[6]), 100 - 3 - 1 - 2 - 3 - amount1)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 1)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3)

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});

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

            // floor protocol fee from 2.4 to 2
            const amount2 = Math.floor((100 - 2 - 1 - 2 - 3) / 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[1]), amount1 + amount2)
            assert.equal(await mockERC20_2.balanceOf(accounts[6]), 100 - 3 - 1 - 2 - 3 - amount1 + 100 - 2 - 1 - 2 - 3 - amount2)
            assert.equal(await mockERC20_2.balanceOf(accounts[2]), 1000 - 100 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[3]), 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[4]), 2 * 2)
            assert.equal(await mockERC20_2.balanceOf(accounts[5]), 3 * 2)
            assert.equal(await mockERC721.balanceOf(accounts[1]), 0)
            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[2])
            assert.equal(await mockERC20_2.balanceOf(communityAddress), 3 + 2)
        })

        it("From erc721(DataV1) to erc20(NO DataV1) Protocol, Origin fees, no Royalties, payouts: 110%, throw", async () => {
            let {leftOrder, rightOrder} = await prepare721DV1_20_110CentsOrders(1000)

            await expectThrow(
                oasesExchange.matchOrders(
                    leftOrder,
                    rightOrder,
                    await getSignature(leftOrder, accounts[1]),
                    EMPTY_DATA,
                    {from: accounts[2]}
                ),
                "total bps of payment is not 100%"
            )
        })

        async function prepare721DV1_20_110CentsOrders(t2Amount) {
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC20_2.mint(accounts[2], t2Amount)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            await mockERC20_2.approve(mockERC20TransferProxy.address, t2Amount, {from: accounts[2]})
            let addOriginLeft = [[accounts[3], 100], [accounts[4], 200]]
            let encodedDataLeft = await encodeDataV1([[[accounts[1], 5000], [accounts[5], 5001]], [], addOriginLeft, true])
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
                "total bps of payment is not 100%"
            )
        })

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: 50/50%", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 5000], [accounts[3], 5000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[3], -(200 - 4 - 14) / 2, async () =>
                    verifyBalanceChange(accounts[1], -(200 - 4 - 14) / 2, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -12, async () =>
                                verifyBalanceChange(accounts[7], -14, async () =>
                                    // floor protocol fee from 4.8 to 4
                                    verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: 50/50%", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 5000], [accounts[3], 5000]], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[3], -(200 - 4 - 14) / 2, async () =>
                    // floor protocol fee from 4.8 to 4
                    verifyBalanceChange(accounts[1], -(200 - 4 - 14) / 2, async () =>
                        verifyBalanceChange(accounts[5], -10, async () =>
                            verifyBalanceChange(accounts[6], -12, async () =>
                                verifyBalanceChange(accounts[7], -14, async () =>
                                    // floor protocol fee from 4.8 to 4
                                    verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From eth(DataV1) to erc721(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: empty 100% to order.maker", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("From erc721(DataV1) to eth(DataV1) Protocol, Origin fees, no Royalties, different Protocol fee(3% && 2.4%), payouts: empty 100% to order.maker", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]

            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[], [], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});
            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 14), async () =>
                    verifyBalanceChange(accounts[5], -10, async () =>
                        verifyBalanceChange(accounts[6], -12, async () =>
                            verifyBalanceChange(accounts[7], -14, async () =>
                                // floor protocol fee from 4.8 to 4
                                verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

    describe("exchange with royalties", () => {
        it("royalties by owner, token erc721 to eth, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [[accounts[3], 500], [accounts[4], 1000]], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});

            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 14 - 10 - 20), async () =>				//200 -4seller - 14 originright
                    verifyBalanceChange(accounts[3], -10, async () =>
                        verifyBalanceChange(accounts[4], -20, async () =>
                            verifyBalanceChange(accounts[5], -10, async () =>
                                verifyBalanceChange(accounts[6], -12, async () =>
                                    verifyBalanceChange(accounts[7], -14, async () =>
                                        // floor protocol fee from 4.8 to 4
                                        verifyBalanceChange(protocolFeeReceiver, -4, () =>
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

        it("royalties by owner, eth to token erc721, different Protocol fee(3% && 2.4%)", async () => {
            await memberCard.mint(accounts[1], 1024);
            await mockERC721.mint(accounts[1], erc721TokenId_1)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})

            let addOriginLeft = [[accounts[5], 500], [accounts[6], 600]]
            let addOriginRight = [[accounts[7], 700]]
            let encodedDataLeft = await encodeDataV1([[[accounts[2], 10000]], [], addOriginLeft, true])
            let encodedDataRight = await encodeDataV1([[[accounts[1], 10000]], [[accounts[3], 500], [accounts[4], 1000]], addOriginRight, true])

            let leftOrder = Order(
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
            let rightOrder = Order(
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

            // change protocol fee to 2.4% for member card owner
            await setMemberCardInfo(240);
            ++leftOrder.salt;
            ++rightOrder.salt;

            await mockERC721.transferFrom(accounts[2], accounts[1], erc721TokenId_1, {from: accounts[2]});

            signatureRight = await getSignature(rightOrder, accounts[1])
            await verifyBalanceChange(accounts[2], 200 + 10 + 12, async () =>
                // floor protocol fee from 4.8 to 4
                verifyBalanceChange(accounts[1], -(200 - 4 - 14 - 10 - 20), async () =>				//200 -4seller - 14 originright
                    verifyBalanceChange(accounts[3], -10, async () =>
                        verifyBalanceChange(accounts[4], -20, async () =>
                            verifyBalanceChange(accounts[5], -10, async () =>
                                verifyBalanceChange(accounts[6], -12, async () =>
                                    verifyBalanceChange(accounts[7], -14, async () =>
                                        // floor protocol fee from 4.8 to 4
                                        verifyBalanceChange(protocolFeeReceiver, -4, () =>
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
    })

    function encodeDataV1(tuple) {
        return mockOasesCashierManager.encodeDataV1(tuple)
    }

    async function getSignature(order, signer) {
        return sign(order, signer, oasesExchange.address)
    }
})
