const ERC721PackageTransferProxy = artifacts.require("ERC721PackageTransferProxy.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const {encodePackageTypeData, ERC721_PACKAGE_CLASS, encode} = require("./types/assets")
const {Asset} = require("./types/order")
const {expectThrow} = require("./utils/expect_throw")


contract("test ERC721PackageTransferProxy.sol", accounts => {
    let erc721PackageTransferProxy
    let mockERC721_1
    let mockERC721_2
    let mockERC721_3

    beforeEach(async () => {
        erc721PackageTransferProxy = await ERC721PackageTransferProxy.new()
        await erc721PackageTransferProxy.__Operators_init()
        await erc721PackageTransferProxy.addOperator(accounts[1])
        mockERC721_1 = await MockERC721.new()
        mockERC721_2 = await MockERC721.new()
        mockERC721_3 = await MockERC721.new()
    })

    it("revert. sender is not Operators", async () => {
        const asset = Asset(
            ERC721_PACKAGE_CLASS,
            encodePackageTypeData([mockERC721_1.address, mockERC721_2.address, mockERC721_3.address], [1, 1, 1]),
            1
        )
        await expectThrow(erc721PackageTransferProxy.transfer(
            asset,
            accounts[0],
            accounts[2],
            ),
            "Operators: caller is not the operator"
        )
    })

    it("good transfer", async () => {
        await mockERC721_1.batchMint(accounts[0], [1, 2, 3])
        await mockERC721_2.mint(accounts[0], 1)
        await mockERC721_3.mint(accounts[0], 1)
        await mockERC721_1.setApprovalForAll(erc721PackageTransferProxy.address, true)
        await mockERC721_2.setApprovalForAll(erc721PackageTransferProxy.address, true)
        await mockERC721_3.setApprovalForAll(erc721PackageTransferProxy.address, true)

        const asset = Asset(
            ERC721_PACKAGE_CLASS,
            encodePackageTypeData(
                [mockERC721_1.address, mockERC721_1.address, mockERC721_1.address, mockERC721_2.address, mockERC721_3.address],
                [1, 2, 3, 1, 1]),
            1
        )
        await erc721PackageTransferProxy.transfer(
            asset,
            accounts[0],
            accounts[2],
            {
                from: accounts[1]
            }
        )

        assert.equal(await mockERC721_1.balanceOf(accounts[0]), 0)
        assert.equal(await mockERC721_2.balanceOf(accounts[0]), 0)
        assert.equal(await mockERC721_3.balanceOf(accounts[0]), 0)
        for (let i = 1; i <= 3; i++) {
            assert.equal(await mockERC721_1.ownerOf(i), accounts[2])
        }
        assert.equal(await mockERC721_2.ownerOf(1), accounts[2])
        assert.equal(await mockERC721_3.ownerOf(1), accounts[2])
    })

    it("revert. bad transfer", async () => {
        await mockERC721_1.batchMint(accounts[0], [1, 2])
        await mockERC721_2.mint(accounts[0], 1)
        await mockERC721_1.setApprovalForAll(erc721PackageTransferProxy.address, true)
        await mockERC721_2.setApprovalForAll(erc721PackageTransferProxy.address, true)

        const asset = Asset(
            ERC721_PACKAGE_CLASS,
            encodePackageTypeData(
                [mockERC721_1.address, mockERC721_2.address, mockERC721_1.address],
                [1, 1, 3]
            ),
            1
        )
        await expectThrow(erc721PackageTransferProxy.transfer(
            asset,
            accounts[0],
            accounts[2],
            {
                from: accounts[1]
            }
            ),
            "ERC721: operator query for nonexistent token"
        )
    })

    it("revert. if value is not 1", async () => {
        await mockERC721_1.batchMint(accounts[0], [1, 2])

        const asset = Asset(
            ERC721_PACKAGE_CLASS,
            encodePackageTypeData(
                [mockERC721_1.address, mockERC721_1.address],
                [1, 2]
            ),
            2
        )
        await expectThrow(
            erc721PackageTransferProxy.transfer(
                asset,
                accounts[0],
                accounts[2],
                {
                    from: accounts[1]
                }
            ),
            "only 1 value for erc721 package"
        )
    })

    it("revert. if it failed to decode asset type data", async () => {
        const asset = Asset(
            ERC721_PACKAGE_CLASS,
            encode(mockERC721_1.address, 1),
            1
        )
        await expectThrow(
            erc721PackageTransferProxy.transfer(
                asset,
                accounts[0],
                accounts[2],
                {
                    from: accounts[1]
                }
            ),
            "VM Exception while processing transaction: revert"
        )
    })

    it("revert. if unmatched length", async () => {
        await mockERC721_1.batchMint(accounts[0], [1, 2])
        await mockERC721_2.mint(accounts[0], 1)
        await mockERC721_1.setApprovalForAll(erc721PackageTransferProxy.address, true)
        await mockERC721_2.setApprovalForAll(erc721PackageTransferProxy.address, true)

        const asset = Asset(
            ERC721_PACKAGE_CLASS,
            encodePackageTypeData(
                [mockERC721_1.address, mockERC721_2.address],
                [1, 1, 2]
            ),
            1
        )
        await expectThrow(erc721PackageTransferProxy.transfer(
            asset,
            accounts[0],
            accounts[2],
            {
                from: accounts[1]
            }
            ),
            "unmatched length"
        )
    })
})
