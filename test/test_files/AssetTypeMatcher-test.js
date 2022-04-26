const MockAssetTypeMatcher = artifacts.require("MockAssetTypeMatcher.sol");
const CustomAssetTypeMatcher = artifacts.require("CustomAssetTypeMatcher.sol");
const order = require("./types/order");
const {generateRandomAddress} = require("./utils/signature");
const {expectThrow} = require("./utils/expect_throw");
const {
    encode,
    calculateBytes4InContract,
    ETH_CLASS,
    ERC20_CLASS,
    ERC721_CLASS,
    ERC1155_CLASS
} = require("./types/assets");

contract("test AssetTypeMatcher.sol", accounts => {
    let mockAssetTypeMatcher

    beforeEach(async () => {
        mockAssetTypeMatcher = await MockAssetTypeMatcher.new();
        await mockAssetTypeMatcher.__MockAssetTypeMatcher_init();
    });

    it("setAssetTypeMatcher() works", async () => {
        const CUSTOM_CLASS = calculateBytes4InContract('CUSTOM_ASSET_CLASS')
        const encodedAddress = encode(generateRandomAddress())
        await expectThrow(
            mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encodedAddress),
                order.AssetType(CUSTOM_CLASS, encodedAddress))
        );

        const customAssetTypeMatcher = await CustomAssetTypeMatcher.new()
        await expectThrow(
            mockAssetTypeMatcher.setAssetTypeMatcher(CUSTOM_CLASS, customAssetTypeMatcher.address, {from: accounts[1]}),
            "Ownable: caller is not the owner"
        )
        await mockAssetTypeMatcher.setAssetTypeMatcher(CUSTOM_CLASS, customAssetTypeMatcher.address)
        let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
            order.AssetType(ERC20_CLASS, encodedAddress), order.AssetType(CUSTOM_CLASS, encodedAddress)
        )
        assert.equal(matchedAssetType[0], ERC20_CLASS)
        assert.equal(matchedAssetType[1], encodedAddress)

        // left asset address is not equal to right one
        matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
            order.AssetType(ERC20_CLASS, encode(generateRandomAddress())),
            order.AssetType(CUSTOM_CLASS, encodedAddress)
        )
        assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
        assert.equal(matchedAssetType[1], order.EMPTY_DATA)
    })

    it("it should revert when both assets are general with different class", async () => {
        const encodedData = "0x1234567890abcdef"
        await expectThrow(
            mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType("0x12345678", encodedData),
                order.AssetType("0x87654321", encodedData)),
            "unknown matching rule"
        );
    })

    describe("match ETH", () => {
        it("should return ETH class if both are ETHs", async () => {
            const encodedAddress = encode(generateRandomAddress())
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ETH_CLASS, encodedAddress),
                order.AssetType(ETH_CLASS, encodedAddress))
            assert.equal(matchedAssetType[0], ETH_CLASS)
            assert.equal(matchedAssetType[1], encodedAddress)
        });

        it("should return ZERO type if one is not ETH", async () => {
            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ETH_CLASS, encode(generateRandomAddress())),
                order.AssetType(ERC20_CLASS, encode(generateRandomAddress()))
            )
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encode(generateRandomAddress())),
                order.AssetType(ETH_CLASS, encode(generateRandomAddress()))
            )
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });
    })

    describe("match ERC20", () => {
        it("should return ERC20 type if both are ERC20 with the same address", async () => {
            const encodedAddress = encode(generateRandomAddress())
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encodedAddress),
                order.AssetType(ERC20_CLASS, encodedAddress))
            assert.equal(matchedAssetType[0], ERC20_CLASS)
            assert.equal(matchedAssetType[1], encodedAddress)
        });

        it("should return zero type if both are ERC20 with different addresses", async () => {
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encode(generateRandomAddress())),
                order.AssetType(ERC20_CLASS, encode(generateRandomAddress()))
            )
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return zero type if other type is not ERC20", async () => {
            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encode(generateRandomAddress())),
                order.AssetType(ETH_CLASS, encode(generateRandomAddress()))
            )
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ETH_CLASS, encode(generateRandomAddress())),
                order.AssetType(ERC20_CLASS, encode(generateRandomAddress()))
            )
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });
    })

    describe("match ERC721", () => {
        it("should return ERC721 type if both are ERC721 with the same address and token id", async () => {
            const encodedData = encode(generateRandomAddress(), 1024, [[accounts[0], 1000], [accounts[1], 200]])
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData),
                order.AssetType(ERC721_CLASS, encodedData))
            assert.equal(matchedAssetType[0], ERC721_CLASS)
            assert.equal(matchedAssetType[1], encodedData)
        });

        it("should return zero type if token ids don't match", async () => {
            const erc721Address = generateRandomAddress()
            const encodedData1 = encode(erc721Address, 1024, [])
            const encodedData2 = encode(erc721Address, 2048, [])
            assert.notEqual(encodedData1, encodedData2)

            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData1),
                order.AssetType(ERC721_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)

            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData2),
                order.AssetType(ERC721_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return zero type if addresses don't match", async () => {
            const encodedData1 = encode(generateRandomAddress(), 1024, [])
            const encodedData2 = encode(generateRandomAddress(), 1024, [])
            assert.notEqual(encodedData1, encodedData2)

            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData1),
                order.AssetType(ERC721_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)

            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData2),
                order.AssetType(ERC721_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return zero type if royaltyInfos don't match", async () => {
            const erc721Address = generateRandomAddress()
            const encodedData1 = encode(erc721Address, 1024, [[accounts[0], 100]])
            const encodedData2 = encode(erc721Address, 1024, [[accounts[0], 99]])
            assert.notEqual(encodedData1, encodedData2)

            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData1),
                order.AssetType(ERC721_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)

            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData2),
                order.AssetType(ERC721_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return zero type if other type is not ERC721", async () => {
            const encodedAddress = encode(generateRandomAddress())
            const encodedData = encode(generateRandomAddress(), 1024, [])
            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData),
                order.AssetType(ERC20_CLASS, encodedAddress))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encodedAddress),
                order.AssetType(ERC721_CLASS, encodedData))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData),
                order.AssetType(ETH_CLASS, encodedAddress))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ETH_CLASS, encodedAddress),
                order.AssetType(ERC721_CLASS, encodedData))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });
    })

    describe("match ERC1155", () => {
        it("should return ERC1155 type if both are the same", async () => {
            const encodedData = encode(generateRandomAddress(), 1024, [[accounts[0], 100], [accounts[1], 200]])
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData),
                order.AssetType(ERC1155_CLASS, encodedData))
            assert.equal(matchedAssetType[0], ERC1155_CLASS)
            assert.equal(matchedAssetType[1], encodedData)
        });

        it("should return zero type if token ids don't match", async () => {
            const erc1155Address = generateRandomAddress()
            const encodedData1 = encode(erc1155Address, 1024, [[accounts[0], 100]])
            const encodedData2 = encode(erc1155Address, 2048, [[accounts[0], 100]])
            assert.notEqual(encodedData1, encodedData2)

            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData1),
                order.AssetType(ERC1155_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)

            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData2),
                order.AssetType(ERC1155_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return zero type if addresses don't match", async () => {
            const encodedData1 = encode(generateRandomAddress(), 1024, [[accounts[0], 100]])
            const encodedData2 = encode(generateRandomAddress(), 1024, [[accounts[0], 100]])
            assert.notEqual(encodedData1, encodedData2)

            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData1),
                order.AssetType(ERC1155_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)

            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData2),
                order.AssetType(ERC1155_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return zero type if royaltyInfos don't match", async () => {
            const erc1155Address = generateRandomAddress()
            const encodedData1 = encode(erc1155Address, 1024, [[accounts[0], 100]])
            const encodedData2 = encode(erc1155Address, 1024, [[accounts[0], 101]])
            assert.notEqual(encodedData1, encodedData2)

            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData1),
                order.AssetType(ERC1155_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)

            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData2),
                order.AssetType(ERC1155_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });

        it("should return nothing if other type is not erc1155", async () => {
            const encodedAddress = encode(generateRandomAddress())
            const encodedData1 = encode(generateRandomAddress(), 1024, [[accounts[0], 100]])
            const encodedData2 = encode(generateRandomAddress(), 2048, [[accounts[0], 100]])
            let matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData1),
                order.AssetType(ERC20_CLASS, encodedAddress))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC20_CLASS, encodedAddress),
                order.AssetType(ERC1155_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData1),
                order.AssetType(ETH_CLASS, encodedAddress))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ETH_CLASS, encodedAddress),
                order.AssetType(ERC1155_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC1155_CLASS, encodedData1),
                order.AssetType(ERC721_CLASS, encodedData2))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
            matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(ERC721_CLASS, encodedData2),
                order.AssetType(ERC1155_CLASS, encodedData1))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });
    })

    describe("general match", () => {
        it("should return left type if asset types are equal", async () => {
            const GENERAL_CLASS = "0x12345678"
            const GENERAL_DATA = "0x1234567890abcdef"
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(GENERAL_CLASS, GENERAL_DATA),
                order.AssetType(GENERAL_CLASS, GENERAL_DATA))
            assert.equal(matchedAssetType[0], GENERAL_CLASS)
            assert.equal(matchedAssetType[1], GENERAL_DATA)
        });

        it("should return zero type if asset types aren't the same", async () => {
            const GENERAL_CLASS = "0x12345678"
            const matchedAssetType = await mockAssetTypeMatcher.mockMatchAssetTypes(
                order.AssetType(GENERAL_CLASS, "0x00"),
                order.AssetType(GENERAL_CLASS, "0x01"))
            assert.equal(matchedAssetType[0], order.ZERO_ASSET_CLASS)
            assert.equal(matchedAssetType[1], order.EMPTY_DATA)
        });
    })
})