const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const ERC721Oases = artifacts.require('ERC721Oases');

const goerli = {
    erc721LazyMintTransferProxy: "0x97978a55386ce9441361549325E6493d4C5f3773",
    transferProxy: "0x2c9da95A8aF78c9516dBD088B3a758cb23FF1181"
}

const rinkeby = {
    erc721LazyMintTransferProxy: "0x6f60E76298787e783E5428d23b5bFF2865Cb0B55",
    transferProxy: "0x2B6d631f987cD96D44f2f71871D8B3882D11ea76"
}

const mainnet = {
    erc721LazyMintTransferProxy: "0xEFaE199C312Ae3eB3ffb78064707FdFB08BbcE2D",
    transferProxy: "0xd1481784449B9F7adf10f7D8a84EaA602975d32E"
}

let settings = {
    goerli,
    rinkeby,
    mainnet,
	default: goerli
};

function getSettings(network) {
	if (settings[network] !== undefined) {
		return settings[network];
	} else {
		return settings["default"];
	}
}

module.exports = async function (deployer, network) {
    const { transferProxy, erc721LazyMintTransferProxy } = getSettings(network)
    console.log(`oases721 deploy params: nftTransfer: ${transferProxy} lazymintNFTTransfer: ${erc721LazyMintTransferProxy}`)
    const oases721 = await deployProxy(
        ERC721Oases,
        ["Oases", "OAS", "", "https://ipfs.oases.com/ipfs/QmaeUU9kRRss8Jrny1Ki4QHpoUyQCwBxT7CPJHFKFgB5EZ", transferProxy, erc721LazyMintTransferProxy],
        { deployer, initializer: '__ERC721Oases_init' }
    );
    console.log("oases721 deployed to:", oases721.address);
};