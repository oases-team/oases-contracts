const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const ERC721OasesOld = artifacts.require('ERC721Oases');
const ERC721OasesNew = artifacts.require('ERC721Oases');

module.exports = async function (deployer) {
    const existing = await ERC721OasesOld.deployed();
    const instance = await upgradeProxy(existing.address, ERC721OasesNew, { deployer });
    console.log("Upgraded", instance.address);
};