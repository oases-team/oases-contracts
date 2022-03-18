// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/OasesCashierManager.sol";
import "../../contracts/oases_exchange/OrderVerifier.sol";
import "../../contracts/oases_exchange/libraries/OrderDataParsingLibrary.sol";
import "../../contracts/oases_exchange/Cashier.sol";
import "../../contracts/royalties/interfaces/IRoyaltiesProvider.sol";

contract MockOasesCashierManager is OasesCashierManager, Cashier, OrderVerifier {

    function encodeData(OrderDataLibrary.Data memory data) pure external returns (bytes memory) {
        return abi.encode(data);
    }

    function __MockOasesCashierManager_init(
        IERC20TransferProxy ERC20TransferProxyAddress,
        INFTTransferProxy NFTTransferProxyAddress,
        uint256 newProtocolFeeBasisPoint,
        address newDefaultFeeReceiver,
        IRoyaltiesProvider newRoyaltiesProvider
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Cashier_init_unchained(ERC20TransferProxyAddress, NFTTransferProxyAddress);
        __OasesCashierManager_init_unchained(
            newProtocolFeeBasisPoint,
            newDefaultFeeReceiver,
            newRoyaltiesProvider
        );
        __OrderVerifier_init_unchained();
    }

    function mockAllocateAssets(
        FillLibrary.FillResult memory fillResult,
        AssetLibrary.AssetType memory matchedMakeAssetType,
        AssetLibrary.AssetType memory matchedTakeAssetType,
        OrderLibrary.Order memory leftOrder,
        OrderLibrary.Order memory rightOrder
    ) payable external {
        allocateAssets(
            fillResult,
            matchedMakeAssetType,
            matchedTakeAssetType,
            leftOrder,
            rightOrder,
            OrderDataParsingLibrary.parse(leftOrder),
            OrderDataParsingLibrary.parse(rightOrder)
        );
    }

    function mockDeductFeeWithBasisPoint(
        uint256 value,
        uint256 amountToCalculateFee,
        uint256 feeBasisPoint
    )
    external
    pure
    returns
    (uint256 rest, uint256 realFee)
    {
        (rest, realFee) = deductFeeWithBasisPoint(value, amountToCalculateFee, feeBasisPoint);
    }

    function mockSumAmountAndFees(
        uint256 amount,
        PartLibrary.Part[] memory orderOriginalFees
    )
    external
    view
    returns
    (uint256 totalSum)
    {
        totalSum = sumAmountAndFees(amount, orderOriginalFees);
    }

    function mockTransferPayment(
        address payer,
        uint256 amountToCalculate,
        AssetLibrary.AssetType memory paymentType,
        PartLibrary.Part[] memory paymentInfos,
        bytes4 direction
    )
    external
    payable
    {
        transferPayment(
            payer,
            amountToCalculate,
            paymentType,
            paymentInfos,
            direction
        );
    }

    function mockTransferFees(
        address payer,
        bool doSumFeeBasisPoints,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory paymentType,
        PartLibrary.Part[] memory feeInfos,
        bytes4 transferType,
        bytes4 direction
    )
    external
    payable
    returns
    (uint256 rest, uint256 totalFeeBasisPoints){
        (rest, totalFeeBasisPoints) = transferFees(
            payer,
            doSumFeeBasisPoints,
            totalAmountAndFeesRest,
            amountToCalculateFee,
            paymentType,
            feeInfos,
            transferType,
            direction
        );
    }

    function mockTransferFeesPure(
        address,
        bool doSumFeeBasisPoints,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory,
        PartLibrary.Part[] memory feeInfos,
        bytes4,
        bytes4
    )
    public
    pure
    returns
    (uint256 rest, uint256 totalFeeBasisPoints){
        rest = totalAmountAndFeesRest;
        for (uint256 i = 0; i < feeInfos.length; ++i) {
            if (doSumFeeBasisPoints) {
                totalFeeBasisPoints += feeInfos[i].value;
            }
            uint256 fee;
            (rest, fee) = deductFeeWithBasisPoint(rest, amountToCalculateFee, feeInfos[i].value);
            if (fee > 0) {
                // transfer fee
                // IGNORE real transfer to check the returns in test
            }
        }
    }

    function mockTransferProtocolFee(
        address payer,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory paymentType,
        bytes4 direction
    )
    external
    payable
    returns
    (uint256 rest)
    {
        rest = transferProtocolFee(
            payer,
            totalAmountAndFeesRest,
            amountToCalculateFee,
            paymentType,
            direction
        );
    }

    function mockTransferProtocolFeeView(
        address,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateFee,
        AssetLibrary.AssetType memory paymentType,
        bytes4
    )
    external
    view
    returns
    (uint256)
    {
        (uint256 rest, uint256 fee) = deductFeeWithBasisPoint(
            totalAmountAndFeesRest,
            amountToCalculateFee,
            protocolFeeBasisPoint * 2
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
            // IGNORE real transfer to check the returns in test
        }

        return rest;
    }

    function mockTransferRoyalties(
        address payer,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateRoyalties,
        AssetLibrary.AssetType memory royaltyType,
        AssetLibrary.AssetType memory nftType,
        bytes4 direction
    )
    external
    payable
    returns
    (uint256)
    {
        return transferRoyalties(
            payer,
            totalAmountAndFeesRest,
            amountToCalculateRoyalties,
            royaltyType,
            nftType,
            direction
        );
    }

    PartLibrary.Part[] mockNFTRoyaltyInfos;

    function setMockNFTRoyaltyInfos(PartLibrary.Part[] memory NFTRoyaltyInfos) external {
        for (uint256 i; i < NFTRoyaltyInfos.length; ++i) {
            mockNFTRoyaltyInfos.push(NFTRoyaltyInfos[i]);
        }
    }

    function mockTransferRoyaltiesView(
        address payer,
        uint256 totalAmountAndFeesRest,
        uint256 amountToCalculateRoyalties,
        AssetLibrary.AssetType memory royaltyType,
        AssetLibrary.AssetType memory nftType,
        bytes4 direction
    )
    external
    view
    returns
    (uint256)
    {
        PartLibrary.Part[] memory royaltyInfos;
        // get infos of royalties
        if (nftType.assetClass == AssetLibrary.ERC721_ASSET_CLASS || nftType.assetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
            // mock royaltyInfos for nft
            royaltyInfos = mockNFTRoyaltyInfos;
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

        (uint256 rest,uint256 totalFeeBasisPoints) = mockTransferFeesPure(
            payer,
            true,
            totalAmountAndFeesRest,
            amountToCalculateRoyalties,
            royaltyType,
            royaltyInfos,
            ROYALTY,
            direction
        );

        require(totalFeeBasisPoints <= 5000, "royalties sum exceeds 50%");

        return rest;
    }

}
