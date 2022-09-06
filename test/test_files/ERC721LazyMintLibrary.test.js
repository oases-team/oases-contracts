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
        // const minter = accounts[1];
        const minter = '0x6373ecD59f0B738B3f3802aDc6b345BA2806C4B8'
        const tokenId = minter + "b00000000000000000000001";
        const tokenURI = "//uri";

        const hash = await mockERC721Library.getHash([tokenId, tokenURI, creators([minter]), [], [zeroWord]], {from: minter})
        assert.equal(hash, '0xcfe3a453b2a59a82b6553374b96ffad9a89795e367a97d16b703949f01228c48');
    });
});