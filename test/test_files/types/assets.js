const ethUtil = require('ethereumjs-util');

function calculateBytes4InContract(inputString) {
    return `0x${ethUtil.keccakFromString(inputString).toString('hex').substring(0, 8)}`;
}

const ETH_CLASS = calculateBytes4InContract("ETH_CLASS");
const ERC20_CLASS = calculateBytes4InContract('ERC20_CLASS');
const ERC721_CLASS = calculateBytes4InContract('ERC721_CLASS');
const ERC1155_CLASS = calculateBytes4InContract('ERC1155_CLASS');
const COLLECTION_CLASS = calculateBytes4InContract('COLLECTION_CLASS');
const CRYPTO_PUNKS_CLASS = calculateBytes4InContract('CRYPTO_PUNKS_CLASS');

module.exports = {
    ETH_CLASS,
    ERC20_CLASS,
    ERC721_CLASS,
    ERC1155_CLASS,
    COLLECTION_CLASS,
    CRYPTO_PUNKS_CLASS
}