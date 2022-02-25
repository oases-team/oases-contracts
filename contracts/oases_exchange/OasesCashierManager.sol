// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./interfaces/ICashierManager.sol";
import "../common_libraries/AssetLibrary.sol";
import "../common_libraries/PartLibrary.sol";
import "./libraries/BasisPointLibrary.sol";
import "./libraries/FeeSideLibrary.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract OasesCashierManager is OwnableUpgradeable, ICashierManager {
    using BasisPointLibrary for uint256;

    uint256 protocolFeeBasisPoint;
    mapping(address => address) feeReceivers;
    address defaultFeeReceiver;
    IRoyaltiesProvider royaltiesRegistry;

    function __OasesCashierManager_init_unchained(
        uint256 newProtocolFeeBasisPoint,
        address newDefaultFeeReceiver,
        address newRoyaltiesRegistryAddress
    ) internal initializer {
        protocolFeeBasisPoint = newProtocolFeeBasisPoint;
        defaultFeeReceiver = newDefaultFeeReceiver;
        royaltiesRegistry = IRoyaltiesProvider(newRoyaltiesRegistryAddress);
    }

    // set basis point of protocol fee by the owner
    function setProtocolFeeBasisPoint(uint256 newProtocolFeeBasisPoint) external onlyOwner {
        protocolFeeBasisPoint = newProtocolFeeBasisPoint;
    }

    // set royalties registry address by the owner
    function setRoyaltiesRegistry(address newRoyaltiesRegistry) external onlyOwner {
        royaltiesRegistry = IRoyaltiesProvider(newRoyaltiesRegistry);
    }

    // set default fee receiver address by the owner
    function setDefaultFeeReceiver(address newDefaultFeeReceiver) external onlyOwner {
        defaultFeeReceiver = newDefaultFeeReceiver;
    }

    // set the receiver for each token by the owner
    function setFeeReceiver(address tokenAddress, address receiver) external onlyOwner {
        feeReceivers[tokenAddress] = receiver;
    }

    // get basis point of protocol fee
    function getProtocolFeeBasisPoint() public view returns (uint256){
        return protocolFeeBasisPoint;
    }

    // get the address of royalties registry
    function getRoyaltiesRegistry() public view returns (address){
        return address(royaltiesRegistry);
    }

    // get the address of default fee receiver
    function getDefaultFeeReceiver() public view returns (address){
        return defaultFeeReceiver;
    }

    // get fee receiver address by asset address
    function getFeeReceiver(address assetAddress) public view returns (address){
        address receiverAddress = feeReceivers[assetAddress];
        if (receiverAddress != address(0)) {
            return receiverAddress;
        }

        return defaultFeeReceiver;
    }

    function allocateAssets(
        FillLibrary.FillResult memory fillResult,
        AssetLibrary.AssetType memory matchedMakeAssetType,
        AssetLibrary.AssetType memory matchedTakeAssetType,
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder,
        OrderDataLibrary.Data memory leftOrderData,
        OrderDataLibrary.Data memory rightOrderData
    )
    internal
    override
    returns
    (uint256 totalMakeAmount, uint256 totalTakeAmount)
    {
        totalMakeAmount = fillResult.leftValue;
        totalTakeAmount = fillResult.rightValue;

        // get fee side
        FeeSideLibrary.FeeSide feeSide = FeeSideLibrary.getFeeSide(
            matchedMakeAssetType.assetClass,
            matchedTakeAssetType.assetClass
        );
        if (feeSide == FeeSideLibrary.FeeSide.MAKE) {

        } else if (feeSide == FeeSideLibrary.FeeSide.TAKE) {

        } else {

        }


    }

    function transferProtocolFee(
        address payer,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory paymentType,
        bytes4 direction
    )
    private
    returns
    (uint256)
    {
        (uint256 rest, uint256 fee) = deductFeeWithBasisPoint(
            totalAmountAndFeesRest,
            amountToCalculateFee,
            protocolFeeBasisPoint
        );
        if (fee > 0) {
            address paymentAddress = address(0);
            if (paymentType.assetClass == AssetLibrary.ERC20_ASSET_CLASS) {
                paymentAddress = abi.decode(paymentType.data, (address));
            } else if (paymentType.assetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
                uint256 tokenId;
                (paymentAddress, tokenId) = abi.decode(paymentType.data, (address, uint256));
            }

            // transfer fee
            transfer(
                AssetLibrary.Asset({
            assetType : paymentType,
            value : fee
            }),
                payer,
                getFeeReceiver(paymentAddress),
                PROTOCOL_FEE,
                direction
            );
        }

        return rest;
    }

    function transferFees(
        address payer,
        bool doSumFeeBasisPoints,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory paymentType,
        PartLibrary.Part[] memory feeInfos,
        bytes4 transferType,
        bytes4 direction
    )
    private
    returns
    (uint256 rest, uint256 totalFeeBasisPoints)
    {
        rest = totalAmountAndFeesRest;
        for (uint256 i = 0; i < feeInfos.length; ++i) {
            if (doSumFeeBasisPoints) {
                totalFeeBasisPoints += feeInfos[i].value;
            }
            uint256 fee;
            (rest, fee) = deductFeeWithBasisPoint(rest, amountToCalculateFee, feeInfos[i].value);
            if (fee > 0) {
                // transfer fee
                transfer(
                    AssetLibrary.Asset({
                assetType : paymentType,
                value : fee
                }),
                    payer,
                    feeInfos[i].account,
                    transferType, direction
                );
            }
        }
    }

    // calculate the sum of amount and all fees
    function sumAmountAndFees(
        uint256 amount,
        PartLibrary.Part[] memory orderOriginalFees
    )
    private
    view
    returns
    (uint256 totalSum)
    {
        totalSum = amount.basisPointCalculate(protocolFeeBasisPoint) + amount;
        for (uint256 i = 0; i < orderOriginalFees.length; ++i) {
            totalSum += amount.basisPointCalculate(orderOriginalFees[i].value);
        }
    }

    function deductFeeWithBasisPoint(
        uint256 value,
        uint256 amountToCalculateFee,
        uint256 feeBasisPoint
    )
    private
    pure
    returns
    (uint256 rest, uint256 realFee){
        uint256 fee = amountToCalculateFee.basisPointCalculate(feeBasisPoint);
        if (value > fee) {
            rest = value - fee;
            realFee = fee;
        } else {
            rest = 0;
            realFee = value;
        }
    }
}
