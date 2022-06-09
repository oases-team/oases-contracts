const ERC20TransferProxy = artifacts.require('ERC20TransferProxy');
const NFTTransferProxy = artifacts.require('NFTTransferProxy');
const ERC721LazyMintTransferProxy = artifacts.require('ERC721LazyMintTransferProxy');

module.exports = async function (deployer) {
    // nftTransferProxy
    await deployer.deploy(NFTTransferProxy, {gas: 1500000});
    const nftTransferProxy = await NFTTransferProxy.deployed();
    await nftTransferProxy.__NFTTransferProxy_init({gas: 200000});
    console.log("deployed nftTransferProxy at", nftTransferProxy.address);

    // erc20TransferProxy
    await deployer.deploy(ERC20TransferProxy, {gas: 1500000});
    const erc20TransferProxy = await ERC20TransferProxy.deployed();
    await erc20TransferProxy.__ERC20TransferProxy_init({gas: 200000});
    console.log("deployed erc20TransferProxy at", erc20TransferProxy.address);

    // erc721LazyMintTransferProxy
    await deployer.deploy(ERC721LazyMintTransferProxy, {gas: 1500000});
    const erc721LazyMintTransferProxy = await ERC721LazyMintTransferProxy.deployed();
    await erc721LazyMintTransferProxy.__ERC721LazyMintTransferProxy_init({gas: 200000});
    console.log("deployed erc721LazyMintTransferProxy at", erc721LazyMintTransferProxy.address);
};