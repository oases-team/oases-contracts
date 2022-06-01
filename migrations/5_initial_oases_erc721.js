const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const ERC721Oases = artifacts.require('ERC721Oases');

const goerli = {
    erc721LazyMintTransferProxy: "0xAC7c0E649294E758cd1853421C4b2FB5210cCA9f",
    transferProxy: "0x809ee61138f3FDA08D01732Eea7b98aafBDAd84c"
}

let settings = {
    goerli,
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
    await deployProxy(
        ERC721Oases, 
        ["Oases", "OAS", "ipfs:/", "", transferProxy, erc721LazyMintTransferProxy],
        { deployer, initializer: '__ERC721Oases_init' }
    );
};