// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./interfaces/ICashierManager.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";
import "../common_libraries/AssetLibrary.sol";
import "../common_libraries/PartLibrary.sol";
import "./libraries/BasisPointLibrary.sol";
import "./libraries/FeeSideLibrary.sol";
import "../tokens/erc721/libraries/ERC721LazyMintLibrary.sol";
import "../tokens/erc1155/libraries/ERC1155LazyMintLibrary.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// todo: developing. not done
abstract contract OasesCashierManager is OwnableUpgradeable, ICashierManager {
    using BasisPointLibrary for uint256;

    uint256 protocolFeeBasisPoint;
    mapping(address => address) feeReceivers;
    address defaultFeeReceiver;
    IRoyaltiesProvider royaltiesProvider;

    function __OasesCashierManager_init_unchained(
        uint256 newProtocolFeeBasisPoint,
        address newDefaultFeeReceiver,
        IRoyaltiesProvider newRoyaltiesProvider
    ) internal initializer {
        protocolFeeBasisPoint = newProtocolFeeBasisPoint;
        defaultFeeReceiver = newDefaultFeeReceiver;
        royaltiesProvider = newRoyaltiesProvider;
    }

    // set basis point of protocol fee by the owner
    function setProtocolFeeBasisPoint(uint256 newProtocolFeeBasisPoint) external onlyOwner {
        protocolFeeBasisPoint = newProtocolFeeBasisPoint;
    }

    // set royalties provider address by the owner
    function setRoyaltiesRegistry(address newRoyaltiesProvider) external onlyOwner {
        royaltiesProvider = IRoyaltiesProvider(newRoyaltiesProvider);
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

    // get the address of royalties provider
    function getRoyaltiesProvider() public view returns (address){
        return address(royaltiesProvider);
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
            totalMakeAmount = transferPaymentWithFeesAndRoyalties(
                leftOrder.maker,
                fillResult.leftValue,
                leftOrderData,
                rightOrderData,
                matchedMakeAssetType,
                matchedTakeAssetType,
                TO_TAKER_DIRECTION
            );
            transferPayment(
                rightOrder.maker,
                fillResult.rightValue,
                matchedTakeAssetType,
                leftOrderData.payoutInfos,
                TO_MAKER_DIRECTION
            );
        } else if (feeSide == FeeSideLibrary.FeeSide.TAKE) {
            totalTakeAmount = transferPaymentWithFeesAndRoyalties(
                rightOrder.maker,
                fillResult.rightValue,
                rightOrderData,
                leftOrderData,
                matchedTakeAssetType,
                matchedMakeAssetType,
                TO_MAKER_DIRECTION
            );
            transferPayment(
                leftOrder.maker,
                fillResult.leftValue,
                matchedMakeAssetType,
                rightOrderData.payoutInfos,
                TO_TAKER_DIRECTION
            );
        } else {
            // no fee side
            transferPayment(
                leftOrder.maker,
                fillResult.leftValue,
                matchedMakeAssetType,
                rightOrderData.payoutInfos,
                TO_TAKER_DIRECTION
            );
            transferPayment(
                rightOrder.maker,
                fillResult.rightValue,
                matchedTakeAssetType,
                leftOrderData.payoutInfos,
                TO_MAKER_DIRECTION
            );
        }
    }

    function transferPaymentWithFeesAndRoyalties(
        address payer,
        uint256 amountToCalculate,
        OrderDataLibrary.Data memory paymentData,
        OrderDataLibrary.Data memory nftData,
        AssetLibrary.AssetType memory paymentType,
        AssetLibrary.AssetType memory nftType,
        bytes4 direction
    )
    internal
    returns
    (uint256 totalAmount)
    {
        totalAmount = sumAmountAndFees(amountToCalculate, paymentData.originFeeInfos);
        uint256 rest = transferProtocolFee(
            payer,
            totalAmount,
            amountToCalculate,
            paymentType,
            direction
        );
        rest = transferRoyalties(
            payer,
            rest,
            amountToCalculate,
            paymentType,
            nftType,
            direction
        );
        (rest,) = transferFees(
            payer,
            false,
            rest,
            amountToCalculate,
            paymentType,
            paymentData.originFeeInfos,
            ORIGIN_FEE,
            direction
        );
        (rest,) = transferFees(
            payer,
            false,
            rest,
            amountToCalculate,
            nftType,
            nftData.originFeeInfos,
            ORIGIN_FEE,
            direction
        );
        transferPayment(
            payer,
            amountToCalculate,
            paymentType,
            nftData.payoutInfos,
            direction
        );
    }

    function transferProtocolFee(
        address payer,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory paymentType,
        bytes4 direction
    )
    internal
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
    internal
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

    // only nft has royalty
    function transferRoyalties(
        address payer,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateRoyalties,
        AssetLibrary.AssetType memory royaltyType,
        AssetLibrary.AssetType memory nftType,
        bytes4 direction
    )
    internal
    returns
    (uint256)
    {
        PartLibrary.Part[] memory royaltyInfos;
        // get infos of royalties
        if (nftType.assetClass == AssetLibrary.ERC721_ASSET_CLASS || nftType.assetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
            // decode nft address and token id
            (address nftAddress,uint256 tokenId) = abi.decode(nftType.data, (address, uint256));
            royaltyInfos = royaltiesProvider.getRoyaltyInfos(nftAddress, tokenId);
        } else if (nftType.assetClass == ERC721LazyMintLibrary.ERC721_LAZY_MINT_ASSET_CLASS) {
            // decode the royaltyInfos of lazy mint erc721
            (, ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData) = abi.decode(
                nftType.data,
                (address, ERC721LazyMintLibrary.ERC721LazyMintData)
            );
            royaltyInfos = erc721LazyMintData.royaltyInfos;
        } else if (nftType.assetClass == ERC1155LazyMintLibrary.ERC1155_LAZY_MINT_ASSET_CLASS) {
            // decode the royaltyInfos of lazy mint erc1155
            (, ERC1155LazyMintLibrary.ERC1155LazyMintData memory erc1155LazyMintData) = abi.decode(
                nftType.data,
                (address, ERC1155LazyMintLibrary.ERC1155LazyMintData)
            );
            royaltyInfos = erc1155LazyMintData.royaltyInfos;
        }

        (uint256 rest,uint256 totalFeeBasisPoints) = transferFees(
            payer,
            true,
            totalAmountAndFeesRest,
            amountToCalculateRoyalties,
            royaltyType,
            royaltyInfos,
            ROYALTY,
            direction
        );
        // todo: confirm the percentage with PD
        require(totalFeeBasisPoints <= 5000, "royalties sum exceeds 50%");

        return rest;
    }

    function transferPayment(
        address payer,
        uint256 amountToCalculate,
        AssetLibrary.AssetType memory paymentType,
        PartLibrary.Part[] memory paymentInfos,
        bytes4 direction
    )
    internal
    {
        uint256 totalFeeBasisPoints;
        uint256 rest = amountToCalculate;
        uint256 lastPartIndex = paymentInfos.length - 1;
        for (uint256 i = 0; i < lastPartIndex; ++i) {
            uint256 amountToPay = amountToCalculate.basisPointCalculate(paymentInfos[i].value);
            totalFeeBasisPoints += paymentInfos[i].value;
            if (rest > 0) {
                rest -= amountToPay;
                transfer(
                    AssetLibrary.Asset({
                assetType : paymentType,
                value : amountToPay
                }),
                    payer,
                    paymentInfos[i].account,
                    direction,
                    PAYMENT
                );
            }
        }

        require(
            totalFeeBasisPoints + paymentInfos[lastPartIndex].value == 10000,
            "total bp of payment is not 100%"
        );
        if (rest > 0) {
            transfer(
                AssetLibrary.Asset({
            assetType : paymentType,
            value : rest
            }),
                payer,
                paymentInfos[lastPartIndex].account,
                direction,
                PAYMENT
            );
        }
    }

    // calculate the sum of amount and all fees
    function sumAmountAndFees(
        uint256 amount,
        PartLibrary.Part[] memory orderOriginalFees
    )
    internal
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
    internal
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

    uint256[46] private __gap;
}
