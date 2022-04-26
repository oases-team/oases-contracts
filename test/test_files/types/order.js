const Eip712 = require("../utils/eip712");
const {calculateBytes4InContract} = require("./assets");
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_ASSET_CLASS = '0x00000000'
const EMPTY_DATA = '0x'
const EMPTY_BYTES4 = ZERO_ASSET_CLASS

const ORDER_V1_DATA_TYPE = calculateBytes4InContract('V1')

function Part(account, value) {
    return {account, value}
}

function Data(payoutInfos, royaltyInfos, originFeeInfos, isMakeFill) {
    return {payoutInfos, royaltyInfos, originFeeInfos, isMakeFill}
}

function AssetType(assetClass, data) {
    return {assetClass, data}
}

function Asset(assetClass, assetData, value) {
    return {assetType: AssetType(assetClass, assetData), value};
}

function Order(maker, makeAsset, taker, takeAsset, salt, startTime, endTime, dataType, data) {
    return {maker, makeAsset, taker, takeAsset, salt, startTime, endTime, dataType, data};
}

const Types = {
    AssetType: [
        {name: 'assetClass', type: 'bytes4'},
        {name: 'data', type: 'bytes'}
    ],
    Asset: [
        {name: 'assetType', type: 'AssetType'},
        {name: 'value', type: 'uint256'}
    ],
    Order: [
        {name: 'maker', type: 'address'},
        {name: 'makeAsset', type: 'Asset'},
        {name: 'taker', type: 'address'},
        {name: 'takeAsset', type: 'Asset'},
        {name: 'salt', type: 'uint256'},
        {name: 'startTime', type: 'uint256'},
        {name: 'endTime', type: 'uint256'},
        {name: 'dataType', type: 'bytes4'},
        {name: 'data', type: 'bytes'},
    ]
};

async function sign(order, account, verifyingContract) {
    // const chainId = Number(await web3.eth.getChainId());
    // for truffle test on ganache-cli
    const chainId = Number(1);
    const data = Eip712.createTypeData({
        name: "OasesExchange",
        version: "1",
        chainId,
        verifyingContract
    }, 'Order', order, Types);
    return (await Eip712.signTypedData(web3, account, data)).sig;
}


function getZeroOrder() {
    return Order(
        ZERO_ADDRESS,
        Asset(ZERO_ASSET_CLASS, EMPTY_DATA, 0),
        ZERO_ADDRESS,
        Asset(ZERO_ASSET_CLASS, EMPTY_DATA, 0),
        0,
        0,
        0,
        "0xffffffff",
        EMPTY_DATA)
}

module.exports = {
    Part,
    AssetType,
    Data,
    Asset,
    Order,
    sign,
    getZeroOrder,
    ZERO_ASSET_CLASS,
    EMPTY_DATA,
    EMPTY_BYTES4,
    ORDER_V1_DATA_TYPE
}