const MockFeeSideLibrary = artifacts.require("MockFeeSideLibrary.sol")
const {
    ETH_CLASS,
    ERC20_CLASS,
    ERC721_CLASS,
    ERC1155_CLASS,
    COLLECTION_CLASS,
    CRYPTO_PUNKS_CLASS
} = require("./types/assets");
const NONE = 0;
const MAKE_SIDE = 1;
const TAKE_SIDE = 2;

contract('test FeeSideLibrary.sol', accounts => {

    let mockFeeSideLibrary;
    let NOT_ASSET = '0xabcdef01';

    before(async () => {
        mockFeeSideLibrary = await MockFeeSideLibrary.new();
    });

    it('make asset: ETH, take asset: ERC20 -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ETH_CLASS, ERC20_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: ERC20, take asset: ETH -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC20_CLASS, ETH_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: ERC20, take asset: ERC1155 -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC20_CLASS, ERC1155_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: ERC1155, take asset: ERC20 -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC1155_CLASS, ERC20_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: ERC1155, take asset: ETH -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC1155_CLASS, ETH_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: ETH, take asset: ERC1155 -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ETH_CLASS, ERC1155_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: ERC721, take asset: ETH -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC721_CLASS, ETH_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: ETH, take asset: ERC721 -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ETH_CLASS, ERC721_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: ERC20, take asset: ERC721 -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC20_CLASS, ERC721_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: ERC721, take asset: ERC20 -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC721_CLASS, ERC20_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: ERC1155, take asset: ERC721 -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC1155_CLASS, ERC721_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: ERC721, take asset: ERC1155 -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC721_CLASS, ERC1155_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: ERC721, take asset: ERC721 -> fee side: none', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ERC721_CLASS, ERC721_CLASS);
        assert.equal(feeSide, NONE);
    });

    it('make asset: ETH, take asset: NOT ASSET -> fee side: make', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(ETH_CLASS, NOT_ASSET);
        assert.equal(feeSide, MAKE_SIDE);
    });

    it('make asset: NOT ASSET, take asset: ERC1155 -> fee side: take', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(NOT_ASSET, ERC1155_CLASS);
        assert.equal(feeSide, TAKE_SIDE);
    });

    it('make asset: NOT ASSET, take asset: NOT ASSET -> fee side: none', async () => {
        const feeSide = await mockFeeSideLibrary.getFeeSide(NOT_ASSET, NOT_ASSET);
        assert.equal(feeSide, NONE);
    });

    it('make asset = take asset (except NOT ASSET or ERC721) -> fee side: make', async () => {
        let feeSide = await mockFeeSideLibrary.getFeeSide(ETH_CLASS, ETH_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
        feeSide = await mockFeeSideLibrary.getFeeSide(ERC20_CLASS, ERC20_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
        feeSide = await mockFeeSideLibrary.getFeeSide(ERC1155_CLASS, ERC1155_CLASS);
        assert.equal(feeSide, MAKE_SIDE);
    });
});