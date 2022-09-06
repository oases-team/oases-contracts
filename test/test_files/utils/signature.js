const ethUtil = require('ethereumjs-util');
const characters = '0123456789abcdef';

function generateRandomPrivateKey() {
    let result = '';
    for (let i = 0; i < 64; ++i) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


function generateRandomAccount() {
    let privKey = Buffer.from(generateRandomPrivateKey(), 'hex');
    return {
        address: ('0x' + ethUtil.privateToAddress(privKey).toString('hex')),
        privateKey: privKey
    }
}

function generateRandomAddress() {
    let privKey = Buffer.from(generateRandomPrivateKey(), 'hex');
    return ('0x' + ethUtil.privateToAddress(privKey).toString('hex'))

}

async function signMessage(msg, account) {
    let signature = (await web3.eth.sign(msg, account)).substring(2);
    const v = ethUtil.bufferToInt(Buffer.from(signature.substr(128, 2), 'hex'));
    return {
        v: (v < 27 ? (v + 27) : v),
        r: ("0x" + signature.substr(0, 64)),
        s: ("0x" + signature.substr(64, 64))
    };
}

module.exports = {signMessage, generateRandomAccount, generateRandomAddress}


