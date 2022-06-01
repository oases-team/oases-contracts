const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const ProtocolFeeProvider = artifacts.require('ProtocolFeeProvider');

module.exports = async function (deployer, network) {
    const defaultProtocolFeeBasisPoint = 250;
    await deployProxy(
        ProtocolFeeProvider,
        [defaultProtocolFeeBasisPoint],
        {deployer, initializer: '__ProtocolFeeProvider_init_unchained'}
    )
}