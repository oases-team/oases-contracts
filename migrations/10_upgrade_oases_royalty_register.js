const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const RoyaltiesRegistryNew = artifacts.require('RoyaltiesRegistry');

module.exports = async function (deployer) {
    const existing = await RoyaltiesRegistryNew.deployed();
    const instance = await upgradeProxy(existing, RoyaltiesRegistryNew, {deployer});
    console.log("Upgraded", instance.address);
};