const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades')
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
    ERC721_CLASS,
    ERC1155_CLASS,
    TO_MAKER_DIRECTION,
    TO_TAKER_DIRECTION,
    PROTOCOL_FEE,
    ROYALTY,
    ORIGIN_FEE,
    PAYMENT,
    ERC721_LAZY_MINT_CLASS
} = require("./types/assets")
const {getRandomInteger} = require('./utils/utils')

contract("test OasesExchange.sol (protocol fee 3% —— seller 3%)", accounts => {
    const TOKEN_ID = accounts[0] + '000000000000000000000001'
    const TOKEN_URI = 'test tokenURI'


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

    function getSignatureForLazyMintData(tokenId, tokenURI, creators, fees, signer) {
        return mint.sign(signer, tokenId, tokenURI, creators, fees, erc721Oases.address)
    }

    async function getERC721OasesAsset(creatorsInfo, feesInfo, signer, tokenId = TOKEN_ID, tokenURI = TOKEN_URI) {
        const signature = await getSignatureForLazyMintData(
            tokenId,
            tokenURI,
            getPartsWithName(creatorsInfo),
            getPartsWithName(feesInfo),
            signer
        )
        let erc721LazyMintData = [tokenId, tokenURI, creatorsInfo, feesInfo, [signature]]
        return Asset(ERC721_LAZY_MINT_CLASS, encodeERC721LazyMintData(erc721Oases.address, erc721LazyMintData), 1)
    }

    function encodeDataV1(tuple) {
        return mockOasesCashierManager.encodeDataV1(tuple)
    }

    async function getSignature(order, signer) {
        return sign(order, signer, oasesExchange.address)
    }

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
    })
})