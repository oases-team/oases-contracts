const {expectThrow} = require("./utils/expect_throw");

const MockERC721LazyMintLibrary = artifacts.require("MockERC721LazyMintLibrary.sol");

contract('test ERC721LazyMintLibrary.sol', accounts => {
    let mockERC721Library;
    const zeroWord = "0x0000000000000000000000000000000000000000000000000000000000000000";

    function creators(list) {
        const value = 10000 / list.length
        return list.map(account => ({ account, value }))
    }

    before(async () => {
        mockERC721Library = await MockERC721LazyMintLibrary.new();
    });

    it('getHash: ', async () => {
        const minter = accounts[1];
        const tokenId = minter + "b00000000000000000000001";
        const tokenURI = "//uri";

        const hash = await mockERC721Library.getHash([tokenId, tokenURI, creators([minter]), [], [zeroWord]], {from: minter})
        assert.equal(hash, '0xa692fd91b60d44e6716abb3a1cbc575bb17b43b6d07826e800df6971023c55ce');
    });
});