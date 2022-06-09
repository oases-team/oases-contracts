const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const RoyaltiesRegistry = artifacts.require('RoyaltiesRegistry');

module.exports = async function (deployer, network) {
    const registry = await deployProxy(
        RoyaltiesRegistry, 
        [],
        { deployer, initializer: '__RoyaltiesRegistry_init' }
    );
    console.log("RoyaltiesRegistry deployed to:", registry.address);
};