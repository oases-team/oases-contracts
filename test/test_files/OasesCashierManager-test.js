const MockOasesCashierManager = artifacts.require("MockOasesCashierManager.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const ProtocolFeeProvider = artifacts.require("ProtocolFeeProvider.sol")

const {getRandomInteger} = require("./utils/utils")
const {generateRandomAddress} = require("./utils/signature")
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")
const {
    Part,
    Data,
    AssetType,
    Asset,
    Order,
    EMPTY_DATA,
    EMPTY_BYTES4,
    ORDER_V1_DATA_TYPE
} = require("./types/order")
const {encode, ETH_CLASS, ERC20_CLASS, ERC721_CLASS, ERC1155_CLASS} = require("./types/assets")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_FLAG_ADDRESS = ZERO_ADDRESS

contract("test OasesCashierManager.sol", accounts => {
    const defaultFeeReceiver = accounts[9]
    const protocolFeeReceiver = accounts[8]
    const erc721TokenId_1 = getRandomInteger(0, 10000)
    const erc721TokenId_2 = erc721TokenId_1 + 1
    const erc1155TokenId_1 = getRandomInteger(0, 10000)
    const erc1155TokenId_2 = erc1155TokenId_1 + 1

    let mockOasesCashierManager
    let mockERC20_1
    let mockERC20_2
    let mockERC721
    let mockERC721MemberCard
    let mockERC1155
    let mockNFTTransferProxy
    let mockERC20TransferProxy
    let protocolFeeProvider

    function encodeDataV1(object) {
        return mockOasesCashierManager.encodeDataV1(object)
    }

    beforeEach(async () => {
        mockNFTTransferProxy = await MockNFTTransferProxy.new()
        mockERC20TransferProxy = await MockERC20TransferProxy.new()
        protocolFeeProvider = await ProtocolFeeProvider.new();
        await protocolFeeProvider.__ProtocolFeeProvider_init(300);

        mockOasesCashierManager = await MockOasesCashierManager.new()
        await mockOasesCashierManager.__MockOasesCashierManager_init(
            mockERC20TransferProxy.address,
            mockNFTTransferProxy.address,
            protocolFeeProvider.address,
            defaultFeeReceiver
        );
        // ERC20
        mockERC20_1 = await MockERC20.new()
        mockERC20_2 = await MockERC20.new()
        // ERC721
        mockERC721 = await MockERC721.new("MockERC721", "M721", "https://erc721mock.com")
        mockERC721MemberCard = await MockERC721.new("MockERC721 memeber card", "M721MC", "https://erc721mock.com")
        // ERC1155
        mockERC1155 = await MockERC1155.new("https://erc1155mock.com")
        await mockOasesCashierManager.setFeeReceiver(ETH_FLAG_ADDRESS, protocolFeeReceiver)
    })

    describe("test setter function with 'onlyOwner'", async () => {
        it("test setProtocolFeeProvider()", async () => {
            const notOwner = accounts[1]
            const owner = accounts[0]
            assert.equal(await mockOasesCashierManager.getProtocolFeeProvider(), protocolFeeProvider.address)
            const newProtocolFeeProvider = await ProtocolFeeProvider.new()

            await expectThrow(
                mockOasesCashierManager.setProtocolFeeProvider(newProtocolFeeProvider.address, {from: notOwner}),
                "Ownable: caller is not the owner"
            )

            await mockOasesCashierManager.setProtocolFeeProvider(newProtocolFeeProvider.address, {from: owner})
            assert.equal(await mockOasesCashierManager.getProtocolFeeProvider(), newProtocolFeeProvider.address)
        })

        it("revert if set an address of EOA in setProtocolFeeProvider()", async () => {
            const owner = accounts[0]
            const EOAAddress = accounts[1]
            assert.equal(await mockOasesCashierManager.getProtocolFeeProvider(), protocolFeeProvider.address)
            await expectThrow(
                mockOasesCashierManager.setProtocolFeeProvider(EOAAddress, {from: owner}),
                'not CA'
            )
        })

        it("test setDefaultFeeReceiver()", async () => {
            const notOwner = accounts[1]
            const owner = accounts[0]
            const randomAddress = web3.utils.toChecksumAddress(generateRandomAddress())
            assert.equal(await mockOasesCashierManager.getDefaultFeeReceiver(), defaultFeeReceiver)
            await expectThrow(
                mockOasesCashierManager.setDefaultFeeReceiver(randomAddress, {from: notOwner}),
                "Ownable: caller is not the owner"
            )

            await mockOasesCashierManager.setDefaultFeeReceiver(randomAddress, {from: owner})
            assert.equal(await mockOasesCashierManager.getDefaultFeeReceiver(), randomAddress)
        })

        it("test setFeeReceiver()", async () => {
            const notOwner = accounts[1]
            const owner = accounts[0]
            const assetAddressExisted = generateRandomAddress()
            const assetAddressNonexistent = generateRandomAddress()
            assert.equal(await mockOasesCashierManager.getFeeReceiver(assetAddressNonexistent), defaultFeeReceiver)
            await expectThrow(
                mockOasesCashierManager.setFeeReceiver(assetAddressExisted, accounts[2], {from: notOwner}),
                "Ownable: caller is not the owner"
            )

            assert.equal(await mockOasesCashierManager.getFeeReceiver(assetAddressExisted), defaultFeeReceiver)
            await mockOasesCashierManager.setFeeReceiver(assetAddressExisted, accounts[2], {from: owner})
            assert.equal(await mockOasesCashierManager.getFeeReceiver(assetAddressExisted), accounts[2])
        })
    })

    it("test deductFeeWithBasisPoint()", async () => {
        let res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
            100, 100, 6000
        )
        assert.equal(res[0], 40)
        assert.equal(res[1], 60)

        res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
            100, 100, 10000
        )
        assert.equal(res[0], 0)
        assert.equal(res[1], 100)

        res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
            50, 100, 10000
        )
        assert.equal(res[0], 0)
        assert.equal(res[1], 50)

        res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
            50, 100, 8000
        )
        assert.equal(res[0], 0)
        assert.equal(res[1], 50)
    })

    it("test sumAmountAndFees()", async () => {
        let parts = [Part(ZERO_ADDRESS, 1000), Part(ZERO_ADDRESS, 2000), Part(ZERO_ADDRESS, 3000)]
        let res = await mockOasesCashierManager.mockSumAmountAndFees(100, parts)
        // 100 + 10 + 20 + 30
        assert.equal(res, 160)

        parts = [Part(ZERO_ADDRESS, 9000)]
        res = await mockOasesCashierManager.mockSumAmountAndFees(100, parts)
        // 100 + 90
        assert.equal(res, 190)
    })

    describe("test transferPayment()", () => {
        it("payment is erc20", async () => {
            await mockERC20_1.mint(accounts[0], 100000)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 100000)
            const paymentType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
            let paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 5000)]
            await mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 2000)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 3000)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 5000)

            paymentInfos = [Part(accounts[4], 10000)]
            await mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 10000)
            assert.equal(await mockERC20_1.balanceOf(accounts[0]), 80000)

            paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4999)]
            await expectThrow(
                mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4),
                "total bps of payment is not 100%"
            )

            paymentInfos = [Part(accounts[1], 10001)]
            await expectThrow(
                mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4),
                "total bps of payment is not 100%"
            )
        })

        it("payment is eth", async () => {
            const paymentType = AssetType(ETH_CLASS, EMPTY_DATA)
            let paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 5000)]

            await verifyBalanceChange(accounts[1], -2000, () =>
                verifyBalanceChange(accounts[2], -3000, () =>
                    verifyBalanceChange(accounts[3], -5000, () =>
                        mockOasesCashierManager.mockTransferPayment(
                            accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'})
                    )
                )
            )

            paymentInfos = [Part(accounts[4], 10000)]
            await verifyBalanceChange(accounts[4], -10000, () =>
                mockOasesCashierManager.mockTransferPayment(
                    accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'})
            )

            paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4999)]
            await expectThrow(
                mockOasesCashierManager.mockTransferPayment(
                    accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'}),
                "total bps of payment is not 100%"
            )

            paymentInfos = [Part(accounts[1], 10001)]
            await expectThrow(
                mockOasesCashierManager.mockTransferPayment(
                    accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'}),
                "total bps of payment is not 100%"
            )
        })

        it("payment is erc1155", async () => {
            await mockERC1155.mint(accounts[0], erc1155TokenId_1, 1000)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
            const paymentType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
            let paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 5000)]
            await mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4)

            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 20)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 30)
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 50)

            paymentInfos = [Part(accounts[4], 10000)]
            await mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4)
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 100)
            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 800)


            paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4999)]
            await expectThrow(
                mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4),
                "total bps of payment is not 100%"
            )

            paymentInfos = [Part(accounts[1], 10001)]
            await expectThrow(
                mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4),
                "total bps of payment is not 100%"
            )
        })
    })

    describe("test transferFees()", () => {
        it("fee is erc20", async () => {
            await mockERC20_1.mint(accounts[0], 100000)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 100000)
            const feeType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
            let feeInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4000)]
            await mockOasesCashierManager.mockTransferFees(
                accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)

            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 2000)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 3000)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 4000)

            // check returns with function mockTransferFeesPure()
            let res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 91000)
            assert.equal(res[1], 9000)

            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 91000)
            assert.equal(res[1], 0)


            feeInfos = [Part(accounts[4], 1000)]
            await mockOasesCashierManager.mockTransferFees(
                accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 1000)

            // check returns with function mockTransferFeesPure()
            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 99000)
            assert.equal(res[1], 1000)

            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 99000)
            assert.equal(res[1], 0)
        })

        it("fee is eth", async () => {
            const feeType = AssetType(ETH_CLASS, EMPTY_DATA)
            let feeInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4000)]
            await verifyBalanceChange(accounts[0], 10000, () =>
                verifyBalanceChange(mockOasesCashierManager.address, -1000, () =>
                    verifyBalanceChange(accounts[1], -2000, () =>
                        verifyBalanceChange(accounts[2], -3000, () =>
                            verifyBalanceChange(accounts[3], -4000, () =>
                                mockOasesCashierManager.mockTransferFees(
                                    accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4, {
                                        value: 10000,
                                        gasPrice: '0x'
                                    })
                            )
                        )
                    )
                )
            )

            // check returns with function mockTransferFeesPure()
            let res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 91000)
            assert.equal(res[1], 9000)

            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 91000)
            assert.equal(res[1], 0)

            feeInfos = [Part(accounts[4], 1000)]
            await verifyBalanceChange(accounts[0], 10000, () =>
                verifyBalanceChange(accounts[4], -1000, () =>
                    mockOasesCashierManager.mockTransferFees(
                        accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4, {
                            value: 10000,
                            gasPrice: '0x'
                        }
                    )
                )
            )

            // check returns with function mockTransferFeesPure()
            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 99000)
            assert.equal(res[1], 1000)

            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 99000)
            assert.equal(res[1], 0)
        })

        it("fee is erc1155", async () => {
            await mockERC1155.mint(accounts[0], erc1155TokenId_1, 1000)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
            const feeType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
            let feeInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4000)]
            await mockOasesCashierManager.mockTransferFees(
                accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)

            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 20)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 30)
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 40)

            // check returns with function mockTransferFeesPure()
            let res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 910)
            assert.equal(res[1], 9000)

            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], false, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 910)
            assert.equal(res[1], 0)


            feeInfos = [Part(accounts[4], 1000)]
            await mockOasesCashierManager.mockTransferFees(
                accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 10)

            // check returns with function mockTransferFeesPure()
            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 990)
            assert.equal(res[1], 1000)

            res = await mockOasesCashierManager.mockTransferFeesPure(
                accounts[0], false, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
            assert.equal(res[0], 990)
            assert.equal(res[1], 0)
        })
    })

    describe("test transferProtocolFee()", () => {
        it("protocol fee is erc20", async () => {
            const payer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockOasesCashierManager.setFeeReceiver(mockERC20_1.address, protocolFeeReceiver)
            // protocol fee 3%
            await mockERC20_1.mint(payer, 10000)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 10000)
            await mockERC721MemberCard.mint(member, erc721TokenId_1);

            const feeType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
            await mockOasesCashierManager.mockTransferProtocolFee(
                payer, member, 100000, 10000, feeType, EMPTY_BYTES4)

            // protocol 3%
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 300)
            assert.equal(await mockERC20_1.balanceOf(payer), 9700)

            // check returns with function mockTransferProtocolFeeView()
            let res = await mockOasesCashierManager.mockTransferProtocolFeeView
            (
                payer, member, 100000, 10000, feeType, EMPTY_BYTES4)
            assert.equal(res, 99700)

            // set member card info in protocolFeeProvider
            // protocol:   owner of nft     -> 1%
            //             not owner of nft -> 3%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            // protocol 1% for member
            await mockOasesCashierManager.mockTransferProtocolFee(
                payer, member, 100000, 10000, feeType, EMPTY_BYTES4)
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 300 + 100)
            assert.equal(await mockERC20_1.balanceOf(payer), 9700 - 100)

            res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, member, 100000, 10000, feeType, EMPTY_BYTES4)
            assert.equal(res, 99900)

            // protocol 3% for nonmember
            await mockOasesCashierManager.mockTransferProtocolFee(
                payer, nonmember, 100000, 10000, feeType, EMPTY_BYTES4)
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 300 + 100 + 300)
            assert.equal(await mockERC20_1.balanceOf(payer), 9700 - 100 - 300)

            res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, nonmember, 100000, 10000, feeType, EMPTY_BYTES4)
            assert.equal(res, 99700)
        })

        it("protocol fee is erc1155", async () => {
            const payer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockOasesCashierManager.setFeeReceiver(mockERC1155.address, protocolFeeReceiver)
            // protocol fee 3%
            await mockERC1155.mint(payer, erc1155TokenId_1, 100)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
            await mockERC721MemberCard.mint(member, erc721TokenId_1);

            const feeType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))

            await mockOasesCashierManager.mockTransferProtocolFee(
                payer, member, 200, 100, feeType, EMPTY_BYTES4)

            // protocol fee 3%
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 3)
            assert.equal(await mockERC1155.balanceOf(payer, erc1155TokenId_1), 97)

            // check returns with function mockTransferProtocolFeeView()
            let res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, member, 200, 100, feeType, EMPTY_BYTES4)
            assert.equal(res, 200 - 3)

            // set member card info in protocolFeeProvider
            // protocol:   owner of nft     -> 1%
            //             not owner of nft -> 3%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            // protocol 1% for member
            await mockOasesCashierManager.mockTransferProtocolFee(
                payer, member, 200, 100, feeType, EMPTY_BYTES4)
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 3 + 1)
            assert.equal(await mockERC1155.balanceOf(payer, erc1155TokenId_1), 97 - 1)

            res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, member, 200, 100, feeType, EMPTY_BYTES4)
            assert.equal(res, 200 - 1)

            // protocol 3% for nonmember
            await mockOasesCashierManager.mockTransferProtocolFee(
                payer, nonmember, 200, 100, feeType, EMPTY_BYTES4)
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 3 + 1 + 3)
            assert.equal(await mockERC1155.balanceOf(payer, erc1155TokenId_1), 97 - 1 - 3)

            res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, nonmember, 200, 100, feeType, EMPTY_BYTES4)
            assert.equal(res, 200 - 3)
        })

        it("protocol fee is eth", async () => {
            const payer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            const feeType = AssetType(ETH_CLASS, EMPTY_DATA)

            // protocol fee 3%
            await verifyBalanceChange(payer, 30, () =>
                verifyBalanceChange(protocolFeeReceiver, -30, () =>
                    mockOasesCashierManager.mockTransferProtocolFee(
                        payer, member, 2000, 1000, feeType, EMPTY_BYTES4, {
                            value: 30,
                            gasPrice: '0x'
                        }
                    )
                )
            )

            // check returns with function mockTransferProtocolFeeView()
            let res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, member, 2000, 1000, feeType, EMPTY_BYTES4)
            assert.equal(res, 1970)

            // set member card info in protocolFeeProvider
            // protocol:   owner of nft     -> 1%
            //             not owner of nft -> 3%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            // protocol 1% for member
            await verifyBalanceChange(payer, 10, () =>
                verifyBalanceChange(protocolFeeReceiver, -10, () =>
                    mockOasesCashierManager.mockTransferProtocolFee(
                        payer, member, 2000, 1000, feeType, EMPTY_BYTES4, {
                            value: 10,
                            gasPrice: '0x'
                        }
                    )
                )
            )

            // check returns with function mockTransferProtocolFeeView()
            res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, member, 2000, 1000, feeType, EMPTY_BYTES4)
            assert.equal(res, 2000 - 10)

            // protocol 3% for nonmember
            await verifyBalanceChange(payer, 30, () =>
                verifyBalanceChange(protocolFeeReceiver, -30, () =>
                    mockOasesCashierManager.mockTransferProtocolFee(
                        payer, nonmember, 2000, 1000, feeType, EMPTY_BYTES4, {
                            from: payer,
                            value: 30,
                            gasPrice: '0x'
                        }
                    )
                )
            )

            // check returns with function mockTransferProtocolFeeView()
            res = await mockOasesCashierManager.mockTransferProtocolFeeView(
                payer, nonmember, 2000, 1000, feeType, EMPTY_BYTES4)
            assert.equal(res, 2000 - 30)
        })
    })

    describe("test transferRoyalties()", () => {
        it("transfer the royalty of erc721 with erc20 as fee", async () => {
            await mockERC20_1.mint(accounts[0], 100000)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 100000)
            const royaltyType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let royaltyInfosForExistedNFT = []

            // no royalty info
            await mockOasesCashierManager.mockTransferRoyalties(
                accounts[0], 100000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)

            assert.equal(await mockERC20_1.balanceOf(accounts[0]), 100000)

            // royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000)]
            await mockOasesCashierManager.mockTransferRoyalties(
                accounts[0], 100000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)

            assert.equal(await mockERC20_1.balanceOf(accounts[0]), 99000)
            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000)

            // append royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000), Part(accounts[2], 1500), Part(accounts[3], 2000)]
            await mockOasesCashierManager.mockTransferRoyalties(
                accounts[0], 100000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)

            assert.equal(await mockERC20_1.balanceOf(accounts[0]), 99000 - 1000 - 1500 - 2000)
            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000 + 1000)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 1500)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 2000)

            // sum of royalty bps is over 5000
            royaltyInfosForExistedNFT = [Part(accounts[1], 3000), Part(accounts[2], 2001)]
            await expectThrow(
                mockOasesCashierManager.mockTransferRoyalties(
                    accounts[0], 100000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4),
                'royalties sum exceeds 50%'
            )

            /* check returns with function mockTransferRoyaltiesPure() */
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000)]
            let res = await mockOasesCashierManager.mockTransferRoyaltiesPure(
                accounts[0], 100000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)
            assert.equal(res, 100000 - 1000)

            royaltyInfosForExistedNFT = [Part(accounts[1], 1000), Part(accounts[2], 1500), Part(accounts[3], 2000)]
            res = await mockOasesCashierManager.mockTransferRoyaltiesPure(
                accounts[0], 100000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)
            assert.equal(res, 100000 - 1000 - 1500 - 2000)
        })

        it("transfer the royalty of erc721 with erc1155 as fee", async () => {
            await mockERC1155.mint(accounts[0], erc1155TokenId_1, 20000)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
            const royaltyType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let royaltyInfosForExistedNFT = []

            // no royalty info
            await mockOasesCashierManager.mockTransferRoyalties(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)

            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 20000)

            // set royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000)]
            await mockOasesCashierManager.mockTransferRoyalties(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)

            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 19000)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 1000)

            // append royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000), Part(accounts[2], 1500), Part(accounts[3], 2000)]
            await mockOasesCashierManager.mockTransferRoyalties(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)

            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 19000 - 1000 - 1500 - 2000)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 1000 + 1000)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 1500)
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 2000)

            // sum of royalty bps is over 5000
            // set royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 3000), Part(accounts[2], 2001)]
            await expectThrow(
                mockOasesCashierManager.mockTransferRoyalties(
                    accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4
                ),
                'royalties sum exceeds 50%'
            )

            /* check returns with function mockTransferRoyaltiesPure() */
            // set royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000)]
            let res = await mockOasesCashierManager.mockTransferRoyaltiesPure(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)
            assert.equal(res, 20000 - 1000)

            royaltyInfosForExistedNFT = [Part(accounts[1], 1000), Part(accounts[2], 1500), Part(accounts[3], 2000)]
            res = await mockOasesCashierManager.mockTransferRoyaltiesPure(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)
            assert.equal(res, 19000 - 1500 - 2000)
        })

        it("transfer the royalty of erc721 with eth as fee", async () => {
            const royaltyType = AssetType(ETH_CLASS, EMPTY_DATA)
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let royaltyInfosForExistedNFT = []

            // no royalty info
            await verifyBalanceChange(accounts[0], 10000, () =>
                verifyBalanceChange(mockOasesCashierManager.address, -10000, () =>
                    mockOasesCashierManager.mockTransferRoyalties(
                        accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4, {
                            value: 10000,
                            gasPrice: '0x'
                        }
                    )
                )
            )

            // set royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000)]
            await verifyBalanceChange(accounts[1], -1000, () =>
                verifyBalanceChange(accounts[0], 10000, () =>
                    verifyBalanceChange(mockOasesCashierManager.address, -9000, () =>
                        mockOasesCashierManager.mockTransferRoyalties(
                            accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4, {
                                value: 10000,
                                gasPrice: '0x'
                            }
                        )
                    )
                )
            )

            // append royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000), Part(accounts[2], 1500), Part(accounts[3], 2000)]
            await verifyBalanceChange(accounts[0], 10000, () =>
                verifyBalanceChange(accounts[1], -1000, () =>
                    verifyBalanceChange(accounts[2], -1500, () =>
                        verifyBalanceChange(accounts[3], -2000, () =>
                            verifyBalanceChange(mockOasesCashierManager.address, -5500, () =>
                                mockOasesCashierManager.mockTransferRoyalties(
                                    accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4, {
                                        value: 10000,
                                        gasPrice: '0x'
                                    }
                                )
                            )
                        )
                    )
                )
            )

            // sum of royalty bps is over 5000
            // set royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 3000), Part(accounts[2], 2001)]
            await expectThrow(
                mockOasesCashierManager.mockTransferRoyalties(
                    accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4, {
                        value: 10000,
                        gasPrice: '0x'
                    }
                ),
                'royalties sum exceeds 50%'
            )

            /* check returns with function mockTransferRoyaltiesPure() */
            // set royalty info
            royaltyInfosForExistedNFT = [Part(accounts[1], 1000)]
            let res = await mockOasesCashierManager.mockTransferRoyaltiesPure(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)
            assert.equal(res, 20000 - 1000)

            royaltyInfosForExistedNFT = [Part(accounts[1], 1000), Part(accounts[2], 1500), Part(accounts[3], 2000)]
            res = await mockOasesCashierManager.mockTransferRoyaltiesPure(
                accounts[0], 20000, 10000, royaltyType, nftType, royaltyInfosForExistedNFT, EMPTY_BYTES4)
            assert.equal(res, 20000 - 1000 - 1500 - 2000)
        })
    })

    describe("test transferPaymentWithFeesAndRoyalties()", () => {
        it("nft: erc721, payment && royalty: erc20", async () => {
            const payer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC20_1.mint(payer, 40000)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 40000, {from: payer})
            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            const paymentType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))

            let paymentData = Data(
                [],
                [],
                [Part(accounts[3], 1000)],
                false)
            let nftData = Data(
                [Part(accounts[4], 8000), Part(accounts[5], 2000)],
                [],
                [Part(accounts[6], 500)],
                false)

            await mockOasesCashierManager.setFeeReceiver(mockERC20_1.address, protocolFeeReceiver)

            nftData.royaltyInfos = [Part(accounts[7], 250)]
            // seller all spend : amount + protocol fee + payment origin fee = 10000*(1+10%) = 11000
            // 1. protocol fee 3%: -> 10000 * 3% = 300
            // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
            // 5. payment (10000-300-250-500=8950) -> accounts[0] 8950 * 80% = 7160 , accounts[2] 8950*20% = 1790
            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                payer,
                member,
                10000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4
            )

            // 1. protocol fee 3%: -> 10000 * 3% = 300
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 300)
            // 2. royalty 2.5%: -> accounts[7] -> 10000 * 2.5% = 250
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 250)
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1000)
            // 4. nft origin fee 5%: -> accounts[6] -> 10000 * 5% = 500
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 500)
            // 5. total payment: 10000 - 300 - 250 - 500 = 8950 ->
            //    accounts[4] 8950 * 80% = 7160 , accounts[5] 8950 * 20% = 1790
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 7160)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 1790)
            assert.equal(await mockERC20_1.balanceOf(payer), 40000 - 11000)

            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                payer,
                member,
                10000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4
            )

            // 1. protocol fee 1%: -> 10000 * 1% = 100
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 300 + 100)
            // 2. royalty 2.5%: -> accounts[7] -> 10000 * 2.5% = 250
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 250 * 2)
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1000 * 2)
            // 4. nft origin fee 5%: -> accounts[6] -> 10000 * 5% = 500
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 500 * 2)
            // 5. total payment: 10000 - 100 - 250 - 500 = 9150 ->
            //    accounts[4] 9150 * 80% = 7320 , accounts[5] 9150 * 20% = 1830
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 7160 + 7320)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 1790 + 1830)
            assert.equal(await mockERC20_1.balanceOf(payer), 40000 - 11000 - 11000)

            // protocol: nonmember -> 3%
            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                payer,
                nonmember,
                10000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4
            )

            // 1. protocol fee 3%: -> 10000 * 3% = 300
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 300 + 100 + 300)
            // 2. royalty 2.5%: -> accounts[7] -> 10000 * 2.5% = 250
            assert.equal(await mockERC20_1.balanceOf(accounts[7]), 250 * 3)
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1000 * 3)
            // 4. nft origin fee 5%: -> accounts[6] -> 10000 * 5% = 500
            assert.equal(await mockERC20_1.balanceOf(accounts[6]), 500 * 3)
            // 5. total payment: 10000 - 300 - 250 - 500 = 8950 ->
            //    accounts[4] 8950 * 80% = 7160 , accounts[5] 8950 * 20% = 1790
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 7160 * 2 + 7320)
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 1790 * 2 + 1830)
            assert.equal(await mockERC20_1.balanceOf(payer), 40000 - 11000 * 3)

        })

        it("nft: erc721, payment && royalty: erc1155", async () => {
            const payer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            await mockERC1155.mint(payer, erc1155TokenId_1, 4000, {from: accounts[1]})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: payer})
            const paymentType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let paymentData = Data(
                [],
                [],
                [Part(accounts[3], 1000)],
                false)
            let nftData = Data(
                [Part(accounts[4], 8000), Part(accounts[5], 2000)],
                [],
                [Part(accounts[6], 500)],
                false)

            await mockOasesCashierManager.setFeeReceiver(mockERC1155.address, protocolFeeReceiver)

            nftData.royaltyInfos = [Part(accounts[7], 250)]
            // seller all spend : amount + protocol fee + payment origin fee = 1000*(1+10%) = 1100
            // 1. protocol fee 3%: -> 1000 * 3% = 30
            // 2. royalty 2.5%: -> accounts[4] -> 1000 * 2.5% = 25
            // 3. payment origin fee 10%: -> accounts[3] -> 1000* 10% = 100
            // 4. nft origin fee 5%: -> accounts[5] -> 1000 * 5% = 50
            // 5. payment (1000-30-25-50=895) -> accounts[0] 895 * 80% = 716 , accounts[2] 895*20% = 179
            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                payer,
                member,
                1000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4
            )

            // 1. protocol fee 3%: -> 1000 * 3% = 30
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 30)
            // 2. royalty 2.5%: -> accounts[7] -> 1000 * 2.5% = 25
            assert.equal(await mockERC1155.balanceOf(accounts[7], erc1155TokenId_1), 25)
            // 3. payment origin fee 10%: -> accounts[3] -> 1000 * 10% = 100
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 100)
            // 4. nft origin fee 5%: -> accounts[5] -> 1000 * 5% = 50
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 50)
            // 5. total payment: 1000 - 30 - 50 - 25 = 895 ->
            //    accounts[4] 895 * 80% = 716 , accounts[5] 895 * 20% = 179
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 716)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 179)
            assert.equal(await mockERC1155.balanceOf(payer, erc1155TokenId_1), 4000 - 1100)

            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                payer,
                member,
                1000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4,
                {from: accounts[1]}
            )

            // 1. protocol fee 1%: -> 1000 * 1% = 10
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 30 + 10)
            // 2. royalty 2.5%: -> accounts[7] -> 1000 * 2.5% = 25
            assert.equal(await mockERC1155.balanceOf(accounts[7], erc1155TokenId_1), 25 * 2)
            // 3. payment origin fee 10%: -> accounts[3] -> 1000 * 10% = 100
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 100 * 2)
            // 4. nft origin fee 5%: -> accounts[6] -> 1000 * 5% = 50
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 50 * 2)
            // 5. total payment: 1000 - 10 - 50 - 25 = 915 ->
            //    accounts[4] 915 * 80% = 732 , accounts[5] 915 * 20% = 183
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 716 + 732)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 179 + 183)
            assert.equal(await mockERC1155.balanceOf(payer, erc1155TokenId_1), 4000 - 1100 * 2)

            // protocol: nonmember -> 3%
            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                payer,
                nonmember,
                1000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4
            )

            // 1. protocol fee 3%: -> 1000 * 3% = 30
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 30 * 2 + 10)
            // 2. royalty 2.5%: -> accounts[7] -> 1000 * 2.5% = 25
            assert.equal(await mockERC1155.balanceOf(accounts[7], erc1155TokenId_1), 25 * 3)
            // 3. payment origin fee 10%: -> accounts[3] -> 1000 * 10% = 100
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 100 * 3)
            // 4. nft origin fee 5%: -> accounts[6] -> 1000 * 5% = 50
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 50 * 3)
            // 5. total payment: 1000 - 30 - 50 - 25 = 895 ->
            //    accounts[4] 895 * 80% = 716 , accounts[5] 895 * 20% = 179
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 716 * 2 + 732)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 179 * 2 + 183)
            assert.equal(await mockERC1155.balanceOf(payer, erc1155TokenId_1), 4000 - 1100 * 3)
        })

        it("nft: erc721, payment && royalty: eth", async () => {
            const payer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            const paymentType = AssetType(ETH_CLASS, EMPTY_DATA)
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let paymentData = Data(
                [],
                [],
                [Part(accounts[3], 1000)],
                false)
            let nftData = Data(
                [Part(accounts[4], 8000), Part(accounts[5], 2000)],
                [],
                [Part(accounts[6], 500)],
                false)

            nftData.royaltyInfos = [Part(accounts[7], 250)]
            // seller all spend : amount + protocol fee + payment origin fee = 10000*(1+10%) = 11000
            // 1. protocol fee 3%: -> 10000 * 3% = 300
            // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
            // 5. payment (10000-300-250-500=8950) -> accounts[0] 8950 * 80% = 7160 , accounts[2] 8950*20% = 1790

            // 1. protocol fee 3%: -> 10000 * 3% = 300
            await verifyBalanceChange(protocolFeeReceiver, -300, () =>
                // 2. royalty 2.5%: -> accounts[7] -> 10000 * 2.5% = 250
                verifyBalanceChange(accounts[7], -250, () =>
                    // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
                    verifyBalanceChange(accounts[3], -1000, () =>
                        // 4. nft origin fee 5%: -> accounts[6] -> 10000 * 5% = 500
                        verifyBalanceChange(accounts[6], -500, () =>
                            // 5. total payment: 10000 - 300 - 250 - 500 = 8950 ->
                            //    accounts[4] 8950 * 80% = 7160 , accounts[5] 8950 * 20% = 1790
                            verifyBalanceChange(accounts[4], -7160, () =>
                                verifyBalanceChange(accounts[5], -1790, () =>
                                    verifyBalanceChange(payer, 20000, () =>
                                        verifyBalanceChange(mockOasesCashierManager.address, -(20000 - 11000), () =>
                                            mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                                                payer,
                                                member,
                                                10000,
                                                paymentData,
                                                nftData,
                                                paymentType,
                                                nftType,
                                                EMPTY_BYTES4,
                                                {from: payer, value: 20000, gasPrice: '0x'}
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )

            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            // 1. protocol fee 1%: -> 10000 * 1% = 100
            await verifyBalanceChange(protocolFeeReceiver, -100, () =>
                // 2. royalty 2.5%: -> accounts[7] -> 10000 * 2.5% = 250
                verifyBalanceChange(accounts[7], -250, () =>
                    // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
                    verifyBalanceChange(accounts[3], -1000, () =>
                        // 4. nft origin fee 5%: -> accounts[6] -> 10000 * 5% = 500
                        verifyBalanceChange(accounts[6], -500, () =>
                            // 5. total payment: 10000 - 100 - 250 - 500 = 9150 ->
                            //    accounts[4] 9150 * 80% = 7320 , accounts[5] 9150 * 20% = 1830
                            verifyBalanceChange(accounts[4], -7320, () =>
                                verifyBalanceChange(accounts[5], -1830, () =>
                                    verifyBalanceChange(payer, 20000, () =>
                                        verifyBalanceChange(mockOasesCashierManager.address, -(20000 - 11000), () =>
                                            mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                                                payer,
                                                member,
                                                10000,
                                                paymentData,
                                                nftData,
                                                paymentType,
                                                nftType,
                                                EMPTY_BYTES4,
                                                {from: payer, value: 20000, gasPrice: '0x'}
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )

            // protocol: nonmember -> 3%
            // 1. protocol fee 3%: -> 10000 * 3% = 300
            await verifyBalanceChange(protocolFeeReceiver, -300, () =>
                // 2. royalty 2.5%: -> accounts[7] -> 10000 * 2.5% = 250
                verifyBalanceChange(accounts[7], -250, () =>
                    // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
                    verifyBalanceChange(accounts[3], -1000, () =>
                        // 4. nft origin fee 5%: -> accounts[6] -> 10000 * 5% = 500
                        verifyBalanceChange(accounts[6], -500, () =>
                            // 5. total payment: 10000 - 300 - 250 - 500 = 8950 ->
                            //    accounts[4] 8950 * 80% = 7160 , accounts[5] 8950 * 20% = 1790
                            verifyBalanceChange(accounts[4], -7160, () =>
                                verifyBalanceChange(accounts[5], -1790, () =>
                                    verifyBalanceChange(payer, 20000, () =>
                                        verifyBalanceChange(mockOasesCashierManager.address, -(20000 - 11000), () =>
                                            mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                                                payer,
                                                nonmember,
                                                10000,
                                                paymentData,
                                                nftData,
                                                paymentType,
                                                nftType,
                                                EMPTY_BYTES4,
                                                {from: payer, value: 20000, gasPrice: '0x'}
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        })
    })

    describe("test allocateAssets()", () => {
        it("Trade from eth to erc1155 with protocol fee 1% && 3% (seller 1% && 3%)", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);

            let [leftOrder, rightOrder] = await genETH_1155Orders(21, member, buyer)

            await verifyBalanceChange(buyer, 100, () =>
                verifyBalanceChange(member, -97, () =>
                    verifyBalanceChange(protocolFeeReceiver, -3, () =>
                        mockOasesCashierManager.mockAllocateAssets(
                            [100, 7],
                            leftOrder.makeAsset.assetType,
                            leftOrder.takeAsset.assetType,
                            leftOrder,
                            rightOrder,
                            {value: 100, from: buyer, gasPrice: 0}
                        )
                    )
                )
            )

            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 7);
            assert.equal(await mockERC1155.balanceOf(member, erc1155TokenId_1), 21 - 7);

            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            await verifyBalanceChange(buyer, 100, () =>
                verifyBalanceChange(member, -99, () =>
                    verifyBalanceChange(protocolFeeReceiver, -1, () =>
                        mockOasesCashierManager.mockAllocateAssets(
                            [100, 7],
                            leftOrder.makeAsset.assetType,
                            leftOrder.takeAsset.assetType,
                            leftOrder,
                            rightOrder,
                            {value: 100, from: buyer, gasPrice: 0}
                        )
                    )
                )
            )

            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 7 * 2);
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 21 - 7 * 2);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await genETH_1155Orders(7, nonmember, buyer)
            await verifyBalanceChange(buyer, 100, () =>
                verifyBalanceChange(nonmember, -97, () =>
                    verifyBalanceChange(protocolFeeReceiver, -3, () =>
                        mockOasesCashierManager.mockAllocateAssets(
                            [100, 7],
                            leftOrder.makeAsset.assetType,
                            leftOrder.takeAsset.assetType,
                            leftOrder,
                            rightOrder,
                            {value: 100, from: buyer, gasPrice: 0}
                        )
                    )
                )
            )

            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 7 * 3);
            assert.equal(await mockERC1155.balanceOf(nonmember, erc1155TokenId_1), 0);
        })

        async function genETH_1155Orders(amountERC1155 = 20, seller, buyer) {
            await mockERC1155.mint(seller, erc1155TokenId_1, amountERC1155)
            await mockERC1155.setApprovalForAll(
                mockNFTTransferProxy.address,
                true,
                {from: seller}
            )

            const leftOrder = Order(
                buyer,
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
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
                ZERO_ADDRESS,
                Asset(ETH_CLASS, "0x", 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            );
            return [leftOrder, rightOrder]
        }

        it("Trade from erc721 to erc721 with no fee", async () => {
            const [leftOrder, rightOrder] = await gen721_721Orders()

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 1],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[1])
            assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[0])
        })

        async function gen721_721Orders() {
            await mockERC721.mint(accounts[0], erc721TokenId_1)
            await mockERC721.mint(accounts[1], erc721TokenId_2)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            const encodedData = await encodeDataV1([[], [], [], true]);
            const leftOrder = Order(
                accounts[0],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData)
            const rightOrder = Order(
                accounts[1],
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_2), 1),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedData)
            return [leftOrder, rightOrder]
        }

        it("Trade from erc721 to erc1155 with 1% && 3% protocol fee(seller 1% && 3%)", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);

            let [leftOrder, rightOrder] = await gen721_1155Orders(250, buyer, member, erc721TokenId_1)

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder)

            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[8])
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 250 - 100 - 2 - 4)
            assert.equal(await mockERC1155.balanceOf(accounts[7], erc1155TokenId_1), 100 - 3 - 1 - 3)
            // check original fee
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 1)
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 3)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 2)
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 4)

            assert.equal(await mockERC1155.balanceOf(defaultFeeReceiver, erc1155TokenId_1), 3)

            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            // transfer nft back to member
            await mockERC721.safeTransferFrom(accounts[8], member, erc721TokenId_1, {from: accounts[8]});

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder)

            assert.equal(await mockERC721.ownerOf(erc721TokenId_1), accounts[8])
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 250 - (100 + 2 + 4) * 2)
            assert.equal(await mockERC1155.balanceOf(accounts[7], erc1155TokenId_1), 100 - 3 - 1 - 3 + (100 - 3 - 1 - 1))
            // check original fee
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 1 * 2)
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 3 * 2)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 2 * 2)
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 4 * 2)

            assert.equal(await mockERC1155.balanceOf(defaultFeeReceiver, erc1155TokenId_1), 3 + 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen721_1155Orders(100, buyer, nonmember, erc721TokenId_2)

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder)

            assert.equal(await mockERC721.ownerOf(erc721TokenId_2), accounts[8])
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 250 - (100 + 2 + 4) * 3 + 100)
            assert.equal(await mockERC1155.balanceOf(accounts[7], erc1155TokenId_1), (100 - 3 - 1 - 3) * 2 + (100 - 3 - 1 - 1))
            // check original fee
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 1 * 3)
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 3 * 3)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 2 * 3)
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 4 * 3)

            assert.equal(await mockERC1155.balanceOf(defaultFeeReceiver, erc1155TokenId_1), 3 * 2 + 1)
        })

        async function gen721_1155Orders(amount1155, buyer, seller, erc721TokenId) {
            await mockERC721.mint(seller, erc721TokenId)
            await mockERC1155.mint(buyer, erc1155TokenId_1, amount1155)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: buyer})

            // original fee info
            const addOriginLeftOrder = [[accounts[3], 100], [accounts[4], 300]]
            const addOriginRightOrder = [[accounts[5], 200], [accounts[6], 400]]

            // change payment info
            const encodedDataLeft = await encodeDataV1([[[accounts[7], 10000]], [], addOriginLeftOrder, true])
            const encodedDataRight = await encodeDataV1([[[accounts[8], 10000]], [], addOriginRightOrder, true])
            const leftOrder = Order(
                seller,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft)
            const rightOrder = Order(
                buyer,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight)
            return [leftOrder, rightOrder]
        }

        // todo:
        it("Trade from erc1155 to erc1155 with 50% && 50% for payments", async () => {
            const {leftOrder, rightOrder} = await gen1155_1155Orders();

            await mockOasesCashierManager.mockAllocateAssets(
                [2, 10],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 100 - 2)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 100 - 10)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)

            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_2), 5)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_2), 5)
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 1)
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 1)
        })

        async function gen1155_1155Orders() {
            await mockERC1155.mint(accounts[1], erc1155TokenId_1, 100)
            await mockERC1155.mint(accounts[2], erc1155TokenId_2, 100)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[2]})
            const encodedDataLeft = await encodeDataV1([[[accounts[3], 5000], [accounts[5], 5000]], [], [], true])
            const encodedDataRight = await encodeDataV1([[[accounts[4], 5000], [accounts[6], 5000]], [], [], true])
            const leftOrder = Order(
                accounts[1],
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 2),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 10),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataLeft)

            const rightOrder = Order(
                accounts[2],
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 10),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 2),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight)
            return {leftOrder, rightOrder}
        }


        it("Trade(floor rounding) from erc1155 to erc1155 with 50% && 50% for payments", async () => {
            const {leftOrder, rightOrder} = await gen1155_1155Orders()

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 5],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 99)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_2), 95)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_2), 0)
            // floor rounding
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_2), 2)
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_2), 5 - 2)
            // floor rounding
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 0)
            assert.equal(await mockERC1155.balanceOf(accounts[6], erc1155TokenId_1), 1 - 0)
            // floor rounding
            assert.equal(await mockERC1155.balanceOf(defaultFeeReceiver, erc1155TokenId_1), 0)
        })

        it("Trade from erc1155 to erc721 with protocol fee 1% && 3% (seller 1% && 3%) of erc1155 protocol receiver", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            let [leftOrder, rightOrder] = await gen1155O_721Orders(110, buyer, member, erc721TokenId_1)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 1],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC721.balanceOf(member), 0)
            assert.equal(await mockERC721.balanceOf(buyer), 1)
            assert.equal(await mockERC1155.balanceOf(member, erc1155TokenId_1), 100 - 1)
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 110 - 100)
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen1155O_721Orders(110, buyer, nonmember, erc721TokenId_2)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 1],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC721.balanceOf(nonmember), 0)
            assert.equal(await mockERC721.balanceOf(buyer), 2)
            assert.equal(await mockERC1155.balanceOf(nonmember, erc1155TokenId_1), 100 - 3)
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), (110 - 100) * 2)
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 1 + 3)
        })

        async function gen1155O_721Orders(amount1155, buyer, seller, erc721TokenId) {
            await mockERC1155.mint(buyer, erc1155TokenId_1, amount1155)
            await mockERC721.mint(seller, erc721TokenId)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: buyer})
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})
            await expectThrow(
                mockOasesCashierManager.setFeeReceiver(mockERC1155.address, protocolFeeReceiver, {from: accounts[1]}),
                "Ownable: caller is not the owner"
            )

            await mockOasesCashierManager.setFeeReceiver(mockERC1155.address, protocolFeeReceiver)

            const leftOrder = Order(
                buyer,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            const rightOrder = Order(
                seller,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            return [leftOrder, rightOrder]
        }

        it("Trade from erc20 to erc1155, protocol fee 1% && 3% (seller 1% && 3%)", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            let [leftOrder, rightOrder] = await gen20_1155Orders(10000000, 10, buyer, member)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 7],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder)

            assert.equal(await mockERC20_1.balanceOf(buyer), 10000000 - 100)
            assert.equal(await mockERC20_1.balanceOf(member), 100 - 1)
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 7)
            assert.equal(await mockERC1155.balanceOf(member, erc1155TokenId_1), 10 - 7)
            assert.equal(await mockERC20_1.balanceOf(defaultFeeReceiver), 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen20_1155Orders(10000000, 10, buyer, nonmember)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 7],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder)

            assert.equal(await mockERC20_1.balanceOf(buyer), (10000000 - 100) * 2)
            assert.equal(await mockERC20_1.balanceOf(nonmember), 100 - 3)
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_1), 7 * 2)
            assert.equal(await mockERC1155.balanceOf(nonmember, erc1155TokenId_1), 10 - 7)
            assert.equal(await mockERC20_1.balanceOf(defaultFeeReceiver), 1 + 3)
        })

        async function gen20_1155Orders(amount20, amount1155, buyer, seller) {
            await mockERC20_1.mint(buyer, amount20)
            await mockERC1155.mint(seller, erc1155TokenId_1, amount1155)
            await mockERC20_1.approve(mockERC20TransferProxy.address, 10000000, {from: buyer})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const leftOrder = Order(
                buyer,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            const rightOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            return [leftOrder, rightOrder]
        }

        it("Trade from erc1155 to erc20, protocol fee 1% && 3% (seller 1% && 3%)", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            let [leftOrder, rightOrder] = await gen1155_20Orders(200, 99999999, buyer, member)

            await mockOasesCashierManager.mockAllocateAssets(
                [7, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_2.balanceOf(member), 100 - 1)
            assert.equal(await mockERC20_2.balanceOf(buyer), 99999999 - 100)
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_2), 7)
            assert.equal(await mockERC1155.balanceOf(member, erc1155TokenId_2), 200 - 7)
            assert.equal(await mockERC20_2.balanceOf(defaultFeeReceiver), 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen1155_20Orders(200, 99999999, buyer, nonmember)

            await mockOasesCashierManager.mockAllocateAssets(
                [7, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_2.balanceOf(nonmember), 100 - 3)
            assert.equal(await mockERC20_2.balanceOf(buyer), (99999999 - 100) * 2)
            assert.equal(await mockERC1155.balanceOf(buyer, erc1155TokenId_2), 7 * 2)
            assert.equal(await mockERC1155.balanceOf(nonmember, erc1155TokenId_2), 200 - 7)
            assert.equal(await mockERC20_2.balanceOf(defaultFeeReceiver), 1 + 3)
        })

        async function gen1155_20Orders(amount1155, amount20, buyer, seller) {
            await mockERC1155.mint(seller, erc1155TokenId_2, amount1155)
            await mockERC20_2.mint(buyer, amount20)
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})
            await mockERC20_2.approve(mockERC20TransferProxy.address, amount20, {from: buyer})

            const leftOrder = Order(
                seller,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 7),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            const rightOrder = Order(
                buyer,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                ZERO_ADDRESS,
                Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_2), 7),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            return [leftOrder, rightOrder]
        }

        it("Trade from erc20 to erc721, protocol fee 1% && 3% (seller 1% && 3%), royalty 10%", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            let [leftOrder, rightOrder] = await gen20_721Orders(300000, buyer, member, erc721TokenId_1)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 1],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_1.balanceOf(buyer), 300000 - 100)
            assert.equal(await mockERC20_1.balanceOf(member), 100 - 1 - 10)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 10)
            assert.equal(await mockERC721.balanceOf(buyer), 1)
            assert.equal(await mockERC721.balanceOf(member), 0)
            assert.equal(await mockERC20_1.balanceOf(defaultFeeReceiver), 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen20_721Orders(300000, buyer, nonmember, erc721TokenId_2)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 1],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_1.balanceOf(buyer), (300000 - 100) * 2)
            assert.equal(await mockERC20_1.balanceOf(nonmember), 100 - 3 - 10)
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 10 * 2)
            assert.equal(await mockERC721.balanceOf(buyer), 2)
            assert.equal(await mockERC721.balanceOf(nonmember), 0)
            assert.equal(await mockERC20_1.balanceOf(defaultFeeReceiver), 1 + 3)
        })

        async function gen20_721Orders(amount20, buyer, seller, erc721TokenId) {
            await mockERC20_1.mint(buyer, amount20)
            await mockERC721.mint(seller, erc721TokenId)
            await mockERC20_1.approve(mockERC20TransferProxy.address, amount20, {from: buyer})
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})

            const leftOrder = Order(
                buyer,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )

            const encodedDataRight = await encodeDataV1([[], [[accounts[3], 1000]], [], true])
            const rightOrder = Order(
                seller,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1), 1),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                ORDER_V1_DATA_TYPE,
                encodedDataRight
            )
            return [leftOrder, rightOrder]
        }

        it("Trade from erc721 to erc20, protocol fee 1% && 3% (seller 1% && 3%)", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            let [leftOrder, rightOrder] = await gen721_20Orders(300000, buyer, member, erc721TokenId_1)

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_2.balanceOf(member), 100 - 1)
            assert.equal(await mockERC20_2.balanceOf(buyer), 300000 - 100)
            assert.equal(await mockERC721.balanceOf(member), 0)
            assert.equal(await mockERC721.balanceOf(buyer), 1)
            assert.equal(await mockERC20_2.balanceOf(defaultFeeReceiver), 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen721_20Orders(300000, buyer, nonmember, erc721TokenId_2)

            await mockOasesCashierManager.mockAllocateAssets(
                [1, 100],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_2.balanceOf(nonmember), 100 - 3)
            assert.equal(await mockERC20_2.balanceOf(buyer), (300000 - 100) * 2)
            assert.equal(await mockERC721.balanceOf(nonmember), 0)
            assert.equal(await mockERC721.balanceOf(buyer), 2)
            assert.equal(await mockERC20_2.balanceOf(defaultFeeReceiver), 1 + 3)
        })

        async function gen721_20Orders(amount20, buyer, seller, erc721TokenId) {
            await mockERC721.mint(seller, erc721TokenId)
            await mockERC20_2.mint(buyer, amount20)
            await mockERC721.setApprovalForAll(mockNFTTransferProxy.address, true, {from: seller})
            await mockERC20_2.approve(mockERC20TransferProxy.address, amount20, {from: buyer})

            const leftOrder = Order(
                seller,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            const rightOrder = Order(
                buyer,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 100),
                ZERO_ADDRESS,
                Asset(ERC721_CLASS, encode(mockERC721.address, erc721TokenId), 1),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            return [leftOrder, rightOrder]
        }

        it("Trade from erc20 to erc20, protocol fee 1% && 3% (seller 1% && 3%)", async () => {
            const buyer = accounts[0]
            const member = accounts[1]
            const nonmember = accounts[2]

            await mockERC721MemberCard.mint(member, erc721TokenId_1);
            // set member card info in protocolFeeProvider
            // protocol: member -> 1%
            await protocolFeeProvider.setMemberCardNFTAddress(mockERC721MemberCard.address)
            await protocolFeeProvider.setMemberCardProtocolFeeBasisPoints(100)

            let [leftOrder, rightOrder] = await gen2Orders(2222, 3333, buyer, member)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 200],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_1.balanceOf(buyer), 2222 - 100)
            assert.equal(await mockERC20_1.balanceOf(member), 100 - 1)
            assert.equal(await mockERC20_2.balanceOf(buyer), 200)
            assert.equal(await mockERC20_2.balanceOf(member), 3333 - 200)
            assert.equal(await mockERC20_1.balanceOf(defaultFeeReceiver), 1);

            // protocol: nonmember -> 3%
            [leftOrder, rightOrder] = await gen2Orders(2222, 3333, buyer, nonmember)

            await mockOasesCashierManager.mockAllocateAssets(
                [100, 200],
                leftOrder.makeAsset.assetType,
                leftOrder.takeAsset.assetType,
                leftOrder,
                rightOrder
            )

            assert.equal(await mockERC20_1.balanceOf(buyer), (2222 - 100) * 2)
            assert.equal(await mockERC20_1.balanceOf(nonmember), 100 - 3)
            assert.equal(await mockERC20_2.balanceOf(buyer), 200 * 2)
            assert.equal(await mockERC20_2.balanceOf(nonmember), 3333 - 200)
            assert.equal(await mockERC20_1.balanceOf(defaultFeeReceiver), 1 + 3)
        })

        async function gen2Orders(amount1, amount2, buyer, seller) {
            await mockERC20_1.mint(buyer, amount1)
            await mockERC20_2.mint(seller, amount2)
            await mockERC20_1.approve(mockERC20TransferProxy.address, amount1, {from: buyer})
            await mockERC20_2.approve(mockERC20TransferProxy.address, amount2, {from: seller})

            const leftOrder = Order(
                buyer,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 200),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            const rightOrder = Order(
                seller,
                Asset(ERC20_CLASS, encode(mockERC20_2.address), 200),
                ZERO_ADDRESS,
                Asset(ERC20_CLASS, encode(mockERC20_1.address), 100),
                1,
                0,
                0,
                "0xffffffff",
                "0x"
            )
            return [leftOrder, rightOrder]
        }
    })
})