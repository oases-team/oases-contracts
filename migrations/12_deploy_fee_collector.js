const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const FeeCollector = artifacts.require('FeeCollector');

module.exports = async function (deployer, network) {
    const defaultProtocolFeeBasisPoint = 250;
    await deployProxy(
        FeeCollector,
        [],
        {deployer, initializer: '__FeeCollector_init'}
    )
}
