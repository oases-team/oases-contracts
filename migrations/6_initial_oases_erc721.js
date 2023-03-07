const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const ERC721Oases = artifacts.require('ERC721Oases');

module.exports = async function (deployer, network) {
    const transferProxy = artifacts.require('NFTTransferProxy').address
    const erc721LazyMintTransferProxy = artifacts.require('ERC721LazyMintTransferProxy').address
    console.log(`oases721 deploy params: nftTransfer: ${transferProxy} lazymintNFTTransfer: ${erc721LazyMintTransferProxy}`)
    const oases721 = await deployProxy(
        ERC721Oases,
        ["Oases", "OAS", "", "https://ipfs.oases.com/ipfs/QmaeUU9kRRss8Jrny1Ki4QHpoUyQCwBxT7CPJHFKFgB5EZ", transferProxy, erc721LazyMintTransferProxy],
        { deployer, initializer: '__ERC721Oases_init' }
    );
    console.log("oases721 deployed to:", oases721.address);
};
