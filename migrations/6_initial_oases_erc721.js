const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const ERC721Oases = artifacts.require('ERC721Oases');

const goerli = {
    erc721LazyMintTransferProxy: "0xAC7c0E649294E758cd1853421C4b2FB5210cCA9f",
    transferProxy: "0x809ee61138f3FDA08D01732Eea7b98aafBDAd84c"
}

const rinkeby = {
    erc721LazyMintTransferProxy: "0x6f60E76298787e783E5428d23b5bFF2865Cb0B55",
    transferProxy: "0x2B6d631f987cD96D44f2f71871D8B3882D11ea76"
}

// todo
const mainnet = {
    erc721LazyMintTransferProxy: "",
    transferProxy: ""
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
        //todo base uri && contract uri
        ["Oases", "OAS", "", "", transferProxy, erc721LazyMintTransferProxy],
        { deployer, initializer: '__ERC721Oases_init' }
    );
    console.log("oases721 deployed to:", oases721.address);
};