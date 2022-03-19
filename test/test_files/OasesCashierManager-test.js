const MockOasesCashierManager = artifacts.require("MockOasesCashierManager.sol")
const MockERC20 = artifacts.require("MockERC20.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const MockERC1155 = artifacts.require("MockERC1155.sol")
const MockNFTTransferProxy = artifacts.require("MockNFTTransferProxy.sol")
const MockERC20TransferProxy = artifacts.require("MockERC20TransferProxy.sol")
const MockRoyaltiesRegistry = artifacts.require("MockRoyaltiesRegistry.sol")

const {getRandomInteger} = require("./utils/utils")
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")
const {
    Part,
    Data,
    AssetType,
    Asset,
    Order,
    sign,
    getZeroOrder,
    ZERO_ASSET_CLASS,
    EMPTY_DATA,
    EMPTY_BYTES4
} = require("./types/order")
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
        mockERC20_2 = await MockERC20.new()
        // ERC721
        mockERC721 = await MockERC721.new("MockERC721", "M721", "https://erc721mock.com")
        // ERC1155
        mockERC1155 = await MockERC1155.new("https://erc1155mock.com")
        // await testing.setFeeReceiver(mockERC20_1.address, protocol);//
        /*ETH*/
        await mockOasesCashierManager.setFeeReceiver(ETH_FLAG_ADDRESS, protocolFeeReceiver)
    })

    // it("test deductFeeWithBasisPoint()", async () => {
    //     let res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
    //         100, 100, 6000
    //     )
    //     assert.equal(res[0], 40)
    //     assert.equal(res[1], 60)
    //
    //     res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
    //         100, 100, 10000
    //     )
    //     assert.equal(res[0], 0)
    //     assert.equal(res[1], 100)
    //
    //     res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
    //         50, 100, 10000
    //     )
    //     assert.equal(res[0], 0)
    //     assert.equal(res[1], 50)
    //
    //     res = await mockOasesCashierManager.mockDeductFeeWithBasisPoint(
    //         50, 100, 8000
    //     )
    //     assert.equal(res[0], 0)
    //     assert.equal(res[1], 50)
    // })
    //
    // it("test sumAmountAndFees()", async () => {
    //     let parts = [Part(ZERO_ADDRESS, 1000), Part(ZERO_ADDRESS, 2000), Part(ZERO_ADDRESS, 3000)]
    //     let res = await mockOasesCashierManager.mockSumAmountAndFees(100, parts)
    //     // 100 + 10 + 20 + 30 +3(protocol)
    //     assert.equal(res, 163)
    //
    //     parts = [Part(ZERO_ADDRESS, 9000)]
    //     res = await mockOasesCashierManager.mockSumAmountAndFees(100, parts)
    //     // 100 + 90 +3(protocol)
    //     assert.equal(res, 193)
    // })
    //
    // describe("test transferPayment()", () => {
    //     it("payment is erc20", async () => {
    //         await mockERC20_1.mint(accounts[0], 100000)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 100000)
    //         const paymentType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
    //         let paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 5000)]
    //         await mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC20_1.balanceOf(accounts[1]), 2000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[2]), 3000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[3]), 5000)
    //
    //         paymentInfos = [Part(accounts[4], 10000)]
    //         await mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[4]), 10000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[0]), 80000)
    //
    //         paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4999)]
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4),
    //             "total bp of payment is not 100%"
    //         )
    //
    //         paymentInfos = [Part(accounts[1], 10001)]
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferPayment(accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4),
    //             "total bp of payment is not 100%"
    //         )
    //     })
    //
    //     it("payment is eth", async () => {
    //         const paymentType = AssetType(ETH_CLASS, EMPTY_DATA)
    //         let paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 5000)]
    //
    //         await verifyBalanceChange(accounts[1], -2000, () =>
    //             verifyBalanceChange(accounts[2], -3000, () =>
    //                 verifyBalanceChange(accounts[3], -5000, () =>
    //                     mockOasesCashierManager.mockTransferPayment(
    //                         accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'})
    //                 )
    //             )
    //         )
    //
    //         paymentInfos = [Part(accounts[4], 10000)]
    //         await verifyBalanceChange(accounts[4], -10000, () =>
    //             mockOasesCashierManager.mockTransferPayment(
    //                 accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'})
    //         )
    //
    //         paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4999)]
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferPayment(
    //                 accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'}),
    //             "total bp of payment is not 100%"
    //         )
    //
    //         paymentInfos = [Part(accounts[1], 10001)]
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferPayment(
    //                 accounts[0], 10000, paymentType, paymentInfos, EMPTY_BYTES4, {value: 10000, gasPrice: '0'}),
    //             "total bp of payment is not 100%"
    //         )
    //     })
    //
    //     it("payment is erc1155", async () => {
    //         await mockERC1155.mint(accounts[0], erc1155TokenId_1, 1000)
    //         await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
    //         const paymentType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
    //         let paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 5000)]
    //         await mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 20)
    //         assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 30)
    //         assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 50)
    //
    //         paymentInfos = [Part(accounts[4], 10000)]
    //         await mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4)
    //         assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 100)
    //         assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 800)
    //
    //
    //         paymentInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4999)]
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4),
    //             "total bp of payment is not 100%"
    //         )
    //
    //         paymentInfos = [Part(accounts[1], 10001)]
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferPayment(accounts[0], 100, paymentType, paymentInfos, EMPTY_BYTES4),
    //             "total bp of payment is not 100%"
    //         )
    //     })
    // })
    //
    // describe("test transferFees()", () => {
    //     it("fee is erc20", async () => {
    //         await mockERC20_1.mint(accounts[0], 100000)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 100000)
    //         const feeType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
    //         let feeInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4000)]
    //         await mockOasesCashierManager.mockTransferFees(
    //             accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC20_1.balanceOf(accounts[1]), 2000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[2]), 3000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[3]), 4000)
    //
    //         // check returns with function mockTransferFeesPure()
    //         let res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 91000)
    //         assert.equal(res[1], 9000)
    //
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 91000)
    //         assert.equal(res[1], 0)
    //
    //
    //         feeInfos = [Part(accounts[4], 1000)]
    //         await mockOasesCashierManager.mockTransferFees(
    //             accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[4]), 1000)
    //
    //         // check returns with function mockTransferFeesPure()
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 99000)
    //         assert.equal(res[1], 1000)
    //
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 99000)
    //         assert.equal(res[1], 0)
    //     })
    //
    //     it("fee is eth", async () => {
    //         const feeType = AssetType(ETH_CLASS, EMPTY_DATA)
    //         let feeInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4000)]
    //         await verifyBalanceChange(accounts[0], 10000, () =>
    //             verifyBalanceChange(mockOasesCashierManager.address, -1000, () =>
    //                 verifyBalanceChange(accounts[1], -2000, () =>
    //                     verifyBalanceChange(accounts[2], -3000, () =>
    //                         verifyBalanceChange(accounts[3], -4000, () =>
    //                             mockOasesCashierManager.mockTransferFees(
    //                                 accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4, {
    //                                     value: 10000,
    //                                     gasPrice: '0x'
    //                                 })
    //                         )
    //                     )
    //                 )
    //             )
    //         )
    //
    //         // check returns with function mockTransferFeesPure()
    //         let res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 91000)
    //         assert.equal(res[1], 9000)
    //
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 91000)
    //         assert.equal(res[1], 0)
    //
    //         feeInfos = [Part(accounts[4], 1000)]
    //         await verifyBalanceChange(accounts[0], 10000, () =>
    //             verifyBalanceChange(accounts[4], -1000, () =>
    //                 mockOasesCashierManager.mockTransferFees(
    //                     accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4, {
    //                         value: 10000,
    //                         gasPrice: '0x'
    //                     }
    //                 )
    //             )
    //         )
    //
    //         // check returns with function mockTransferFeesPure()
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], true, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 99000)
    //         assert.equal(res[1], 1000)
    //
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], false, 100000, 10000, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 99000)
    //         assert.equal(res[1], 0)
    //     })
    //
    //     it("fee is erc1155", async () => {
    //         await mockERC1155.mint(accounts[0], erc1155TokenId_1, 1000)
    //         await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
    //         const feeType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
    //         let feeInfos = [Part(accounts[1], 2000), Part(accounts[2], 3000), Part(accounts[3], 4000)]
    //         await mockOasesCashierManager.mockTransferFees(
    //             accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 20)
    //         assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 30)
    //         assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 40)
    //
    //         // check returns with function mockTransferFeesPure()
    //         let res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 910)
    //         assert.equal(res[1], 9000)
    //
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], false, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 910)
    //         assert.equal(res[1], 0)
    //
    //
    //         feeInfos = [Part(accounts[4], 1000)]
    //         await mockOasesCashierManager.mockTransferFees(
    //             accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 10)
    //
    //         // check returns with function mockTransferFeesPure()
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], true, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 990)
    //         assert.equal(res[1], 1000)
    //
    //         res = await mockOasesCashierManager.mockTransferFeesPure(
    //             accounts[0], false, 1000, 100, feeType, feeInfos, EMPTY_BYTES4, EMPTY_BYTES4)
    //         assert.equal(res[0], 990)
    //         assert.equal(res[1], 0)
    //     })
    // })
    //
    // describe("test transferProtocolFee()", () => {
    //     it("protocol fee is erc20", async () => {
    //         await mockOasesCashierManager.setFeeReceiver(mockERC20_1.address, protocolFeeReceiver)
    //         // protocol fee 3%
    //         await mockERC20_1.mint(accounts[0], 10000)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 10000)
    //         const feeType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
    //         await mockOasesCashierManager.mockTransferProtocolFee(
    //             accounts[0], 100000, 10000, feeType, EMPTY_BYTES4)
    //
    //         // double 3% = 6%
    //         assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 600)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[0]), 9400)
    //
    //         // check returns with function mockTransferProtocolFeeView()
    //         const res = await mockOasesCashierManager.mockTransferProtocolFeeView(
    //             accounts[0], 100000, 10000, feeType, EMPTY_BYTES4)
    //         assert.equal(res, 99400)
    //     })
    //
    //     it("protocol fee is erc1155", async () => {
    //         await mockOasesCashierManager.setFeeReceiver(mockERC1155.address, protocolFeeReceiver)
    //         // protocol fee 3%
    //         await mockERC1155.mint(accounts[0], erc1155TokenId_1, 100)
    //         await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
    //         const feeType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
    //         await mockOasesCashierManager.mockTransferProtocolFee(
    //             accounts[0], 200, 100, feeType, EMPTY_BYTES4)
    //
    //         // double 3% = 6%
    //         assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 6)
    //         assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 94)
    //
    //         // check returns with function mockTransferProtocolFeeView()
    //         const res = await mockOasesCashierManager.mockTransferProtocolFeeView(
    //             accounts[0], 200, 100, feeType, EMPTY_BYTES4)
    //         assert.equal(res, 194)
    //     })
    //
    //     it("protocol fee is eth", async () => {
    //         // protocol fee 3%
    //         const feeType = AssetType(ETH_CLASS, EMPTY_DATA)
    //         // double 3% = 6%
    //         await verifyBalanceChange(accounts[0], 60, () =>
    //             verifyBalanceChange(protocolFeeReceiver, -60, () =>
    //                 mockOasesCashierManager.mockTransferProtocolFee(
    //                     accounts[0], 2000, 1000, feeType, EMPTY_BYTES4, {
    //                         value: 60,
    //                         gasPrice: '0x'
    //                     }
    //                 )
    //             )
    //         )
    //
    //         // check returns with function mockTransferProtocolFeeView()
    //         const res = await mockOasesCashierManager.mockTransferProtocolFeeView(
    //             accounts[0], 2000, 1000, feeType, EMPTY_BYTES4)
    //         assert.equal(res, 1940)
    //     })
    // })

    // describe("test transferRoyalties()", () => {
    //     it("transfer the royalty of erc721 with erc20 as fee", async () => {
    //         await mockERC20_1.mint(accounts[0], 100000)
    //         await mockERC20_1.approve(mockERC20TransferProxy.address, 100000)
    //         const royaltyType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
    //         const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
    //         // no royalty info in MockRoyaltiesRegistry
    //         await mockOasesCashierManager.mockTransferRoyalties(
    //             accounts[0], 100000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC20_1.balanceOf(accounts[0]), 100000)
    //
    //         // set royalty info into MockRoyaltiesRegistry
    //         let royaltyInfo = [Part(accounts[1], 1000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await mockOasesCashierManager.mockTransferRoyalties(
    //             accounts[0], 100000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC20_1.balanceOf(accounts[0]), 99000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000)
    //
    //         // append royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[2], 1500), Part(accounts[3], 2000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await mockOasesCashierManager.mockTransferRoyalties(
    //             accounts[0], 100000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC20_1.balanceOf(accounts[0]), 99000 - 1000 - 1500 - 2000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[1]), 1000 + 1000)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[2]), 1500)
    //         assert.equal(await mockERC20_1.balanceOf(accounts[3]), 2000)
    //
    //         // sum of royalty bps is over 5000
    //         // set royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[1], 3000), Part(accounts[2], 2001)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferRoyalties(
    //                 accounts[0], 100000, 10000, royaltyType, nftType, EMPTY_BYTES4),
    //             'royalties sum exceeds 50%'
    //         )
    //
    //         /* check returns with function mockTransferRoyaltiesView() */
    //         // set royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[1], 1000)]
    //         await mockOasesCashierManager.setMockNFTRoyaltyInfos(royaltyInfo)
    //         let res = await mockOasesCashierManager.mockTransferRoyaltiesView(
    //             accounts[0], 100000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //         assert.equal(res, 100000 - 1000)
    //
    //         royaltyInfo = [Part(accounts[2], 1500), Part(accounts[3], 2000)]
    //         await mockOasesCashierManager.setMockNFTRoyaltyInfos(royaltyInfo)
    //         res = await mockOasesCashierManager.mockTransferRoyaltiesView(
    //             accounts[0], 100000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //         assert.equal(res, 100000 - 1000 - 1500 - 2000)
    //     })
    //
    //     it("transfer the royalty of erc721 with erc1155 as fee", async () => {
    //         await mockERC1155.mint(accounts[0], erc1155TokenId_1, 20000)
    //         await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true)
    //         const royaltyType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
    //         const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
    //         // no royalty info in MockRoyaltiesRegistry
    //         await mockOasesCashierManager.mockTransferRoyalties(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 20000)
    //
    //         // set royalty info into MockRoyaltiesRegistry
    //         let royaltyInfo = [Part(accounts[1], 1000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await mockOasesCashierManager.mockTransferRoyalties(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 19000)
    //         assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 1000)
    //
    //         // append royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[2], 1500), Part(accounts[3], 2000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await mockOasesCashierManager.mockTransferRoyalties(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //
    //         assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 19000 - 1000 - 1500 - 2000)
    //         assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 1000 + 1000)
    //         assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 1500)
    //         assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 2000)
    //
    //         // sum of royalty bps is over 5000
    //         // set royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[4], 5000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferRoyalties(
    //                 accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4),
    //             'royalties sum exceeds 50%'
    //         )
    //
    //         /* check returns with function mockTransferRoyaltiesView() */
    //         // set royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[1], 1000)]
    //         await mockOasesCashierManager.setMockNFTRoyaltyInfos(royaltyInfo)
    //         let res = await mockOasesCashierManager.mockTransferRoyaltiesView(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //         assert.equal(res, 20000 - 1000)
    //
    //         royaltyInfo = [Part(accounts[2], 1500), Part(accounts[3], 2000)]
    //         await mockOasesCashierManager.setMockNFTRoyaltyInfos(royaltyInfo)
    //         res = await mockOasesCashierManager.mockTransferRoyaltiesView(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //         assert.equal(res, 19000 - 1500 - 2000)
    //     })
    //
    //     it("transfer the royalty of erc721 with eth as fee", async () => {
    //         const royaltyType = AssetType(ETH_CLASS, EMPTY_DATA)
    //         const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
    //         // no royalty info in MockRoyaltiesRegistry
    //         await verifyBalanceChange(accounts[0], 10000, () =>
    //             verifyBalanceChange(mockOasesCashierManager.address, -10000, () =>
    //                 mockOasesCashierManager.mockTransferRoyalties(
    //                     accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4, {value: 10000, gasPrice: '0x'}
    //                 )
    //             )
    //         )
    //
    //         // set royalty info into MockRoyaltiesRegistry
    //         let royaltyInfo = [Part(accounts[1], 1000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await verifyBalanceChange(accounts[1], -1000, () =>
    //             verifyBalanceChange(accounts[0], 10000, () =>
    //                 verifyBalanceChange(mockOasesCashierManager.address, -9000, () =>
    //                     mockOasesCashierManager.mockTransferRoyalties(
    //                         accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4, {
    //                             value: 10000,
    //                             gasPrice: '0x'
    //                         }
    //                     )
    //                 )
    //             )
    //         )
    //
    //         // append royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[2], 1500), Part(accounts[3], 2000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await verifyBalanceChange(accounts[0], 10000, () =>
    //             verifyBalanceChange(accounts[1], -1000, () =>
    //                 verifyBalanceChange(accounts[2], -1500, () =>
    //                     verifyBalanceChange(accounts[3], -2000, () =>
    //                         verifyBalanceChange(mockOasesCashierManager.address, -5500, () =>
    //                             mockOasesCashierManager.mockTransferRoyalties(
    //                                 accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4, {
    //                                     value: 10000,
    //                                     gasPrice: '0x'
    //                                 }
    //                             )
    //                         )
    //                     )
    //                 )
    //             )
    //         )
    //
    //         // sum of royalty bps is over 5000
    //         // set royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[4], 5000)]
    //         await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
    //         await expectThrow(
    //             mockOasesCashierManager.mockTransferRoyalties(
    //                 accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4, {
    //                     value: 10000,
    //                     gasPrice: '0x'
    //                 }
    //             ),
    //             'royalties sum exceeds 50%'
    //         )
    //
    //         /* check returns with function mockTransferRoyaltiesView() */
    //         // set royalty info into MockRoyaltiesRegistry
    //         royaltyInfo = [Part(accounts[1], 1000)]
    //         await mockOasesCashierManager.setMockNFTRoyaltyInfos(royaltyInfo)
    //         let res = await mockOasesCashierManager.mockTransferRoyaltiesView(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //         assert.equal(res, 20000 - 1000)
    //
    //         royaltyInfo = [Part(accounts[2], 1500), Part(accounts[3], 2000)]
    //         await mockOasesCashierManager.setMockNFTRoyaltyInfos(royaltyInfo)
    //         res = await mockOasesCashierManager.mockTransferRoyaltiesView(
    //             accounts[0], 20000, 10000, royaltyType, nftType, EMPTY_BYTES4)
    //         assert.equal(res, 20000 - 1000 - 1500 - 2000)
    //     })
    // })

    describe("test transferPaymentWithFeesAndRoyalties()", () => {
        it("nft: erc721, payment && royalty: erc20", async () => {
            await mockERC20_1.mint(accounts[1], 20000, {from: accounts[1]})
            await mockERC20_1.approve(mockERC20TransferProxy.address, 20000, {from: accounts[1]})
            const paymentType = AssetType(ERC20_CLASS, encode(mockERC20_1.address))
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let paymentData = Data(
                [],
                [Part(accounts[3], 1000)],
                false)
            let nftData = Data(
                [Part(accounts[0], 8000), Part(accounts[2], 2000)],
                [Part(accounts[5], 500)],
                false)

            await mockOasesCashierManager.setFeeReceiver(mockERC20_1.address, protocolFeeReceiver)

            let royaltyInfo = [Part(accounts[4], 250)]
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
            // seller all spend : amount + protocol fee + payment origin fee = 10000*(1+3%+10%) = 11300
            // 1. protocol fee 3%: double -> 10000 * 3% *2 = 600
            // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
            // 5. payment (10000-600-250-1000-500=7650) -> accounts[0] 7650 * 80% = 6120 , accounts[2] 7650*20% = 1530
            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                accounts[1],
                10000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4,
                {from: accounts[1]}
            )

            // 1. protocol fee 3%: double -> 10000 * 3% * 2 = 600
            assert.equal(await mockERC20_1.balanceOf(protocolFeeReceiver), 600)
            // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
            assert.equal(await mockERC20_1.balanceOf(accounts[4]), 250)
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            assert.equal(await mockERC20_1.balanceOf(accounts[3]), 1000)
            // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
            assert.equal(await mockERC20_1.balanceOf(accounts[5]), 500)
            // 5. total payment: 11300 - 600 - 1000 - 250 - 500 = 8950 ->
            //    accounts[0] 8950 * 80% = 7160 , accounts[2] 8950 * 20% = 1790
            assert.equal(await mockERC20_1.balanceOf(accounts[0]), 7160)
            assert.equal(await mockERC20_1.balanceOf(accounts[2]), 1790)
            assert.equal(await mockERC20_1.balanceOf(accounts[1]), 20000 - 11300)
        })

        it("nft: erc721, payment && royalty: erc1155", async () => {
            await mockERC1155.mint(accounts[1], erc1155TokenId_1, 2000, {from: accounts[1]})
            await mockERC1155.setApprovalForAll(mockNFTTransferProxy.address, true, {from: accounts[1]})
            const paymentType = AssetType(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1))
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let paymentData = Data(
                [],
                [Part(accounts[3], 1000)],
                false)
            let nftData = Data(
                [Part(accounts[0], 8000), Part(accounts[2], 2000)],
                [Part(accounts[5], 500)],
                false)

            await mockOasesCashierManager.setFeeReceiver(mockERC1155.address, protocolFeeReceiver)

            let royaltyInfo = [Part(accounts[4], 250)]
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
            // seller all spend : amount + protocol fee + payment origin fee = 10000*(1+3%+10%) = 11300
            // 1. protocol fee 3%: double -> 10000 * 3% *2 = 600
            // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
            // 5. payment (10000-600-250-1000-500=7650) -> accounts[0] 7650 * 80% = 6120 , accounts[2] 7650*20% = 1530
            await mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                accounts[1],
                1000,
                paymentData,
                nftData,
                paymentType,
                nftType,
                EMPTY_BYTES4,
                {from: accounts[1]}
            )

            // 1. protocol fee 3%: double -> 1000 * 3% * 2 = 60
            assert.equal(await mockERC1155.balanceOf(protocolFeeReceiver, erc1155TokenId_1), 60)
            // 2. royalty 2.5%: -> accounts[4] -> 1000 * 2.5% = 25
            assert.equal(await mockERC1155.balanceOf(accounts[4], erc1155TokenId_1), 25)
            // 3. payment origin fee 10%: -> accounts[3] -> 1000 * 10% = 100
            assert.equal(await mockERC1155.balanceOf(accounts[3], erc1155TokenId_1), 100)
            // 4. nft origin fee 5%: -> accounts[5] -> 1000 * 5% = 50
            assert.equal(await mockERC1155.balanceOf(accounts[5], erc1155TokenId_1), 50)
            // 5. total payment: 1130 - 60 - 100 - 25 - 50 = 895 ->
            //    accounts[0] 895 * 80% = 716 , accounts[2] 895 * 20% = 179
            assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 716)
            assert.equal(await mockERC1155.balanceOf(accounts[2], erc1155TokenId_1), 179)
            assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 2000 - 1130)
        })

        it("nft: erc721, payment && royalty: eth", async () => {
            const paymentType = AssetType(ETH_CLASS, EMPTY_DATA)
            const nftType = AssetType(ERC721_CLASS, encode(mockERC721.address, erc721TokenId_1))
            let paymentData = Data(
                [],
                [Part(accounts[3], 1000)],
                false)
            let nftData = Data(
                [Part(accounts[0], 8000), Part(accounts[2], 2000)],
                [Part(accounts[5], 500)],
                false)

            let royaltyInfo = [Part(accounts[4], 250)]
            await mockRoyaltiesRegistry.setRoyaltiesByTokenAndTokenId(mockERC721.address, erc721TokenId_1, royaltyInfo)
            // seller all spend : amount + protocol fee + payment origin fee = 10000*(1+3%+10%) = 11300
            // 1. protocol fee 3%: double -> 10000 * 3% *2 = 600
            // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
            // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
            // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
            // 5. payment (10000-600-250-1000-500=7650) -> accounts[0] 7650 * 80% = 6120 , accounts[2] 7650*20% = 1530

            // 1. protocol fee 3%: double -> 10000 * 3% * 2 = 600
            await verifyBalanceChange(protocolFeeReceiver, -600, () =>
                // 2. royalty 2.5%: -> accounts[4] -> 10000 * 2.5% = 250
                verifyBalanceChange(accounts[4], -250, () =>
                    // 3. payment origin fee 10%: -> accounts[3] -> 10000* 10% = 1000
                    verifyBalanceChange(accounts[3], -1000, () =>
                        // 4. nft origin fee 5%: -> accounts[5] -> 10000 * 5% = 500
                        verifyBalanceChange(accounts[5], -500, () =>
                            // 5. total payment: 11300 - 600 - 1000 - 250 - 500 = 8950 ->
                            //    accounts[0] 8950 * 80% = 7160 , accounts[2] 8950 * 20% = 1790
                            verifyBalanceChange(accounts[0], -7160, () =>
                                verifyBalanceChange(accounts[2], -1790, () =>
                                    verifyBalanceChange(accounts[1], 20000, () =>
                                        verifyBalanceChange(mockOasesCashierManager.address, -(20000 - 11300), () =>
                                            mockOasesCashierManager.mockTransferPaymentWithFeesAndRoyalties(
                                                accounts[1],
                                                10000,
                                                paymentData,
                                                nftData,
                                                paymentType,
                                                nftType,
                                                EMPTY_BYTES4,
                                                {from: accounts[1], value: 20000, gasPrice: '0x'}
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

    // describe("test allocateAssets()", () => {
    //     it("Transfer from ETH to ERC1155, protocol fee 6% (buyerFee 3%, sellerFee 3%)", async () => {
    //         const {leftOrder, rightOrder} = await genETH_1155Orders(10)
    //
    //         // await verifyBalanceChange(accounts[0], 103, () =>
    //         //     verifyBalanceChange(accounts[2], -97, () =>
    //         //         verifyBalanceChange(protocolFeeReceiver, -6, () =>
    //         //             mockOasesCashierManager.mockAllocateAssets(
    //         //                 [100, 7],
    //         //                 leftOrder.makeAsset.assetType,
    //         //                 leftOrder.takeAsset.assetType,
    //         //                 leftOrder,
    //         //                 rightOrder,
    //         //                 {value: 103, from: accounts[0], gasPrice: 0}
    //         //             )
    //         //         )
    //         //     )
    //         // )
    //         await mockOasesCashierManager.mockAllocateAssets(
    //             [100, 7],
    //             leftOrder.makeAsset.assetType,
    //             leftOrder.takeAsset.assetType,
    //             leftOrder,
    //             rightOrder,
    //             {value: 106, from: accounts[0], gasPrice: 0}
    //         )
    //         assert.equal(await mockERC1155.balanceOf(accounts[0], erc1155TokenId_1), 7);
    //         assert.equal(await mockERC1155.balanceOf(accounts[1], erc1155TokenId_1), 3);
    //     })
    //
    //     async function genETH_1155Orders(amountERC1155 = 10) {
    //         await mockERC1155.mint(accounts[1], erc1155TokenId_1, amountERC1155)
    //         await mockERC1155.setApprovalForAll(
    //             mockNFTTransferProxy.address,
    //             true,
    //             {from: accounts[1]}
    //         )
    //
    //         const leftOrder = Order(
    //             accounts[0],
    //             Asset(ETH_CLASS, "0x", 100),
    //             ZERO_ADDRESS,
    //             Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             "0x"
    //         )
    //         const rightOrder = Order(
    //             accounts[1],
    //             Asset(ERC1155_CLASS, encode(mockERC1155.address, erc1155TokenId_1), 7),
    //             ZERO_ADDRESS,
    //             Asset(ETH_CLASS, "0x", 100),
    //             1,
    //             0,
    //             0,
    //             "0xffffffff",
    //             "0x"
    //         );
    //         return {leftOrder, rightOrder}
    //     }
    //
    //     // it("Transfer from ERC721 to ERC721", async () => {
    //     //     const {left, right} = await prepare721_721Orders()
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 1], left, right);
    //     //
    //     //     assert.equal(await erc721.ownerOf(erc721TokenId1), accounts[2]);
    //     //     assert.equal(await erc721.ownerOf(erc721TokenId0), accounts[1]);
    //     // })
    //     //
    //     // async function prepare721_721Orders() {
    //     //     await erc721.mint(accounts[1], erc721TokenId1);
    //     //     await erc721.mint(accounts[2], erc721TokenId0);
    //     //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
    //     //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
    //     //     let data = await encDataV1([[], []]);
    //     //     const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId0), 1), 1, 0, 0, ORDER_DATA_V1, data);
    //     //     const right = Order(accounts[2], Asset(ERC721, enc(erc721.address, erc721TokenId0), 1), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, data);
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC721 to ERC1155, (buyerFee3%, sallerFee3% = 6%) of ERC1155 transfer to community, orders dataType == V1", async () => {
    //     //     const {left, right} = await prepare721_1155Orders(110)
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 100], left, right);
    //     //
    //     //     assert.equal(await erc721.balanceOf(accounts[1]), 0);
    //     //     assert.equal(await erc721.balanceOf(accounts[2]), 1);
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 93);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 1);
    //     //     assert.equal(await erc1155.balanceOf(community, erc1155TokenId1), 6);
    //     // })
    //     //
    //     // async function prepare721_1155Orders(t2Amount = 105) {
    //     //     await erc721.mint(accounts[1], erc721TokenId1);
    //     //     await erc1155.mint(accounts[2], erc1155TokenId1, t2Amount);
    //     //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
    //     //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
    //     //     /*in this: accounts[3] - address originLeftOrder, 100 - originLeftOrderFee(bp%)*/
    //     //     let addrOriginLeft = [[accounts[3], 100], [accounts[5], 300]];
    //     //     let addrOriginRight = [[accounts[4], 200], [accounts[6], 400]];
    //     //     let encDataLeft = await encDataV1([[[accounts[1], 10000]], addrOriginLeft]);
    //     //     let encDataRight = await encDataV1([[[accounts[2], 10000]], addrOriginRight]);
    //     //     const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
    //     //     const right = Order(accounts[2], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, ORDER_DATA_V1, encDataRight);
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC1155 to ERC1155: 2 to 10, 50% 50% for payouts", async () => {
    //     //     const {left, right} = await prepare1155_1155Orders();
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [2, 10], left, right);
    //     //
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 98);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 0);
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId2), 0);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId2), 90);
    //     //
    //     //     assert.equal(await erc1155.balanceOf(accounts[3], erc1155TokenId2), 5);
    //     //     assert.equal(await erc1155.balanceOf(accounts[5], erc1155TokenId2), 5);
    //     //     assert.equal(await erc1155.balanceOf(accounts[4], erc1155TokenId1), 1);
    //     //     assert.equal(await erc1155.balanceOf(accounts[6], erc1155TokenId1), 1);
    //     // });
    //     //
    //     // async function prepare1155_1155Orders() {
    //     //     await erc1155.mint(accounts[1], erc1155TokenId1, 100);
    //     //     await erc1155.mint(accounts[2], erc1155TokenId2, 100);
    //     //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
    //     //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
    //     //     let encDataLeft = await encDataV1([[[accounts[3], 5000], [accounts[5], 5000]], []]);
    //     //     let encDataRight = await encDataV1([[[accounts[4], 5000], [accounts[6], 5000]], []]);
    //     //     const left = Order(accounts[1], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 2), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 10), 1, 0, 0, ORDER_DATA_V1, encDataLeft);
    //     //     const right = Order(accounts[2], Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 10), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 2), 1, 0, 0, ORDER_DATA_V1, encDataRight);
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("rounding error Transfer from ERC1155 to ERC1155: 1 to 5, 50% 50% for payouts", async () => {
    //     //     const {left, right} = await prepare1155_1155Orders();
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 5], left, right);
    //     //
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 99);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 0);
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId2), 0);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId2), 95);
    //     //
    //     //     assert.equal(await erc1155.balanceOf(accounts[3], erc1155TokenId2), 2);
    //     //     assert.equal(await erc1155.balanceOf(accounts[5], erc1155TokenId2), 3);
    //     //     assert.equal(await erc1155.balanceOf(accounts[4], erc1155TokenId1), 0);
    //     //     assert.equal(await erc1155.balanceOf(accounts[6], erc1155TokenId1), 1);
    //     //     assert.equal(await erc1155.balanceOf(community, erc1155TokenId1), 0);
    //     // });
    //     //
    //     // it("Transfer from ERC1155 to ERC721, (buyerFee3%, sallerFee3% = 6%) of ERC1155 protocol (buyerFee3%, sallerFee3%)", async () => {
    //     //     const {left, right} = await prepare1155O_721rders(105)
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 1], left, right);
    //     //
    //     //     assert.equal(await erc721.balanceOf(accounts[2]), 0);
    //     //     assert.equal(await erc721.balanceOf(accounts[1]), 1);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 97);
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 2);
    //     //     assert.equal(await erc1155.balanceOf(protocol, erc1155TokenId1), 6);
    //     // })
    //     //
    //     // async function prepare1155O_721rders(t2Amount = 105) {
    //     //     await erc1155.mint(accounts[1], erc1155TokenId1, t2Amount);
    //     //     await erc721.mint(accounts[2], erc721TokenId1);
    //     //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
    //     //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
    //     //     await testing.setFeeReceiver(erc1155.address, protocol);
    //     //     const left = Order(accounts[1], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, "0xffffffff", "0x");
    //     //     const right = Order(accounts[2], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 100), 1, 0, 0, "0xffffffff", "0x");
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC20 to ERC1155, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
    //     //     const {left, right} = await prepare20_1155Orders(105, 10)
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 7], left, right);
    //     //
    //     //     assert.equal(await t1.balanceOf(accounts[1]), 2);
    //     //     assert.equal(await t1.balanceOf(accounts[2]), 97);
    //     //     assert.equal(await erc1155.balanceOf(accounts[1], erc1155TokenId1), 7);
    //     //     assert.equal(await erc1155.balanceOf(accounts[2], erc1155TokenId1), 3);
    //     //     assert.equal(await t1.balanceOf(protocol), 6);
    //     // })
    //     //
    //     // async function prepare20_1155Orders(t1Amount = 105, t2Amount = 10) {
    //     //     await t1.mint(accounts[1], t1Amount);
    //     //     await erc1155.mint(accounts[2], erc1155TokenId1, t2Amount);
    //     //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[1]});
    //     //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
    //     //
    //     //     const left = Order(accounts[1], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 7), 1, 0, 0, "0xffffffff", "0x");
    //     //     const right = Order(accounts[2], Asset(ERC1155, enc(erc1155.address, erc1155TokenId1), 7), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC1155 to ERC20, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
    //     //     const {left, right} = await prepare1155_20Orders(10, 105)
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [7, 100], left, right);
    //     //
    //     //     assert.equal(await t1.balanceOf(accounts[3]), 97);
    //     //     assert.equal(await t1.balanceOf(accounts[4]), 2);
    //     //     assert.equal(await erc1155.balanceOf(accounts[3], erc1155TokenId2), 3);
    //     //     assert.equal(await erc1155.balanceOf(accounts[4], erc1155TokenId2), 7);
    //     //     assert.equal(await t1.balanceOf(protocol), 6);
    //     // })
    //     //
    //     // async function prepare1155_20Orders(t1Amount = 10, t2Amount = 105) {
    //     //     await erc1155.mint(accounts[3], erc1155TokenId2, t1Amount);
    //     //     await t1.mint(accounts[4], t2Amount);
    //     //     await erc1155.setApprovalForAll(transferProxy.address, true, {from: accounts[3]});
    //     //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[4]});
    //     //
    //     //     const left = Order(accounts[3], Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 7), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
    //     //     const right = Order(accounts[4], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC1155, enc(erc1155.address, erc1155TokenId2), 7), 1, 0, 0, "0xffffffff", "0x");
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC20 to ERC721, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
    //     //     const {left, right} = await prepare20_721Orders()
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 1], left, right);
    //     //
    //     //     assert.equal(await t1.balanceOf(accounts[1]), 2);
    //     //     assert.equal(await t1.balanceOf(accounts[2]), 97);
    //     //     assert.equal(await erc721.balanceOf(accounts[1]), 1);
    //     //     assert.equal(await erc721.balanceOf(accounts[2]), 0);
    //     //     assert.equal(await t1.balanceOf(protocol), 6);
    //     // })
    //     //
    //     // async function prepare20_721Orders(t1Amount = 105) {
    //     //     await t1.mint(accounts[1], t1Amount);
    //     //     await erc721.mint(accounts[2], erc721TokenId1);
    //     //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[1]});
    //     //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[2]});
    //     //
    //     //     const left = Order(accounts[1], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, "0xffffffff", "0x");
    //     //     const right = Order(accounts[2], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC721 to ERC20, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
    //     //     const {left, right} = await prepare721_20Orders()
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [1, 100], left, right);
    //     //
    //     //     assert.equal(await t1.balanceOf(accounts[1]), 97);
    //     //     assert.equal(await t1.balanceOf(accounts[2]), 2);
    //     //     assert.equal(await erc721.balanceOf(accounts[1]), 0);
    //     //     assert.equal(await erc721.balanceOf(accounts[2]), 1);
    //     //     assert.equal(await t1.balanceOf(protocol), 6);
    //     // })
    //     //
    //     // async function prepare721_20Orders(t1Amount = 105) {
    //     //     await erc721.mint(accounts[1], erc721TokenId1);
    //     //     await t1.mint(accounts[2], t1Amount);
    //     //     await erc721.setApprovalForAll(transferProxy.address, true, {from: accounts[1]});
    //     //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[2]});
    //     //
    //     //     const left = Order(accounts[1], Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
    //     //     const right = Order(accounts[2], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC721, enc(erc721.address, erc721TokenId1), 1), 1, 0, 0, "0xffffffff", "0x");
    //     //     return {left, right}
    //     // }
    //     //
    //     // it("Transfer from ERC20 to ERC20, protocol fee 6% (buyerFee3%, sallerFee3%)", async () => {
    //     //     const {left, right} = await prepare2Orders()
    //     //
    //     //     await testing.checkDoTransfers(left.makeAsset.assetType, left.takeAsset.assetType, [100, 200], left, right);
    //     //
    //     //     assert.equal(await t1.balanceOf(accounts[1]), 2);
    //     //     assert.equal(await t1.balanceOf(accounts[2]), 97);
    //     //     assert.equal(await t2.balanceOf(accounts[1]), 200);
    //     //     assert.equal(await t2.balanceOf(accounts[2]), 20);
    //     //     assert.equal(await t1.balanceOf(protocol), 6);
    //     // })
    //     //
    //     // async function prepare2Orders(t1Amount = 105, t2Amount = 220) {
    //     //     await t1.mint(accounts[1], t1Amount);
    //     //     await t2.mint(accounts[2], t2Amount);
    //     //     await t1.approve(erc20TransferProxy.address, 10000000, {from: accounts[1]});
    //     //     await t2.approve(erc20TransferProxy.address, 10000000, {from: accounts[2]});
    //     //
    //     //     const left = Order(accounts[1], Asset(ERC20, enc(t1.address), 100), ZERO, Asset(ERC20, enc(t2.address), 200), 1, 0, 0, "0xffffffff", "0x");
    //     //     const right = Order(accounts[2], Asset(ERC20, enc(t2.address), 200), ZERO, Asset(ERC20, enc(t1.address), 100), 1, 0, 0, "0xffffffff", "0x");
    //     //     return {left, right}
    //     // }
    // })

})