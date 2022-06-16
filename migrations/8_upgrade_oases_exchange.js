const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const OasesExchangeNew = artifacts.require('OasesExchange');

module.exports = async function (deployer) {
    const existing = await OasesExchangeNew.deployed();
    const instance = await upgradeProxy(existing, OasesExchangeNew, {deployer});
    console.log("Upgraded", instance.address);
};