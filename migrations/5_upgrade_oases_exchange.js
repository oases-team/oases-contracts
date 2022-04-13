const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const OasesExchangeOld = artifacts.require('OasesExchange');
const OasesExchangeNew = artifacts.require('OasesExchange');

module.exports = async function (deployer) {
    const existing = await OasesExchangeOld.deployed();
    const instance = await upgradeProxy(existing.address, OasesExchangeNew, {deployer});
    console.log("Upgraded", instance.address);
};