const ethUtil = require('ethereumjs-util')

function calculateBytes4InContract(inputString) {
    return `0x${ethUtil.keccakFromString(inputString).toString('hex').substring(0, 8)}`;
}

const ETH_CLASS = calculateBytes4InContract("ETH_CLASS")
const ERC20_CLASS = calculateBytes4InContract('ERC20_CLASS')
const ERC721_CLASS = calculateBytes4InContract('ERC721_CLASS')
const ERC721_OLD_CLASS = calculateBytes4InContract('ERC721_OLD_CLASS') // for CryptoKitties
const ERC1155_CLASS = calculateBytes4InContract('ERC1155_CLASS')
const COLLECTION_CLASS = calculateBytes4InContract('COLLECTION_CLASS')
const CRYPTO_PUNKS_CLASS = calculateBytes4InContract('CRYPTO_PUNKS_CLASS')
const ERC721_LAZY_MINT_CLASS = calculateBytes4InContract('ERC721_LAZY_MINT_CLASS')

// transfer direction
const TO_MAKER_DIRECTION = calculateBytes4InContract("TO_MAKER_DIRECTION")
const TO_TAKER_DIRECTION = calculateBytes4InContract("TO_TAKER_DIRECTION")

// transfer type
const PROTOCOL_FEE = calculateBytes4InContract("PROTOCOL_FEE_TYPE")
const ROYALTY = calculateBytes4InContract("ROYALTY_TYPE")
const ORIGIN_FEE = calculateBytes4InContract("ORIGIN_FEE_TYPE")
const PAYMENT = calculateBytes4InContract("PAYMENT_TYPE")

function encode(tokenAddress, tokenId) {
    if (tokenId) {
        return web3.eth.abi.encodeParameters(["address", "uint256"], [tokenAddress, tokenId])
    } else {
        return web3.eth.abi.encodeParameter("address", tokenAddress)
    }
}

function encodeERC721LazyMintData(tokenAddress, erc721LazyMintData) {
    return web3.eth.abi.encodeParameters(
        ['address', '(uint256,string,(address,uint96)[],(address,uint96)[],bytes[])'],
        [
            tokenAddress,
            erc721LazyMintData
        ]
    )
}

module.exports = {
    encodeERC721LazyMintData,
    encode,
    calculateBytes4InContract,
    ETH_CLASS,
    ERC20_CLASS,
    ERC721_CLASS,
    ERC721_OLD_CLASS,
    ERC1155_CLASS,
    COLLECTION_CLASS,
    CRYPTO_PUNKS_CLASS,
    ERC721_LAZY_MINT_CLASS,
    TO_MAKER_DIRECTION,
    TO_TAKER_DIRECTION,
    PROTOCOL_FEE,
    ROYALTY,
    ORIGIN_FEE,
    PAYMENT,
}