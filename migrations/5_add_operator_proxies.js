const ERC20TransferProxy = artifacts.require('ERC20TransferProxy');
const NFTTransferProxy = artifacts.require('NFTTransferProxy');
const ERC721LazyMintTransferProxy = artifacts.require('ERC721LazyMintTransferProxy');
const OasesExchange = artifacts.require('OasesExchange');

const {ERC721_LAZY_MINT_CLASS} = require("../test/test_files/types/assets.js")

module.exports = async function (deployer) {
    const oasesExchange = (await OasesExchange.deployed());
    console.log('oases exchange address', oasesExchange.address);

    // add oasesExchange as operator to proxies
    const nftTransferProxy = await NFTTransferProxy.deployed();
    await nftTransferProxy.addOperator(oasesExchange.address);
    console.log('finish adding operator to nftTransferProxy');

    const erc20TransferProxy = await ERC20TransferProxy.deployed();
    await erc20TransferProxy.addOperator(oasesExchange.address);
    console.log('finish adding operator to erc20TransferProxy');

    const erc721LazyMintTransferProxy = await ERC721LazyMintTransferProxy.deployed();
    await erc721LazyMintTransferProxy.addOperator(oasesExchange.address);
    console.log('finish adding operator to erc721LazyMintTransferProxy');
    await oasesExchange.setTransferProxy(ERC721_LAZY_MINT_CLASS, erc721LazyMintTransferProxy.address);
    console.log('finish set transfer proxy for erc721LazyMintTransferProxy');
};