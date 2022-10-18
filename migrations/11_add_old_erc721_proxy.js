const OldERC721TransferProxy = artifacts.require('OldERC721TransferProxy');
const OasesExchange = artifacts.require('OasesExchange');

const {ERC721_OLD_CLASS} = require("../test/test_files/types/assets.js")

module.exports = async function (deployer) {
    await deployer.deploy(OldERC721TransferProxy, {gas: 1500000});
    const oldERC721TransferProxy = await OldERC721TransferProxy.deployed();
    await oldERC721TransferProxy.__OldERC721TransferProxy_init({gas: 200000});
    console.log("deployed oldERC721TransferProxy at", oldERC721TransferProxy.address);

    const oasesExchange = (await OasesExchange.deployed());
    console.log('oases exchange address', oasesExchange.address);

    // add oasesExchange as operator to proxies
    await oldERC721TransferProxy.addOperator(oasesExchange.address);
    console.log('finish adding operator to nftTransferProxy');

    await oasesExchange.setTransferProxy(ERC721_OLD_CLASS, oldERC721TransferProxy.address);
    console.log('finish set transfer proxy for erc721LazyMintTransferProxy');
};