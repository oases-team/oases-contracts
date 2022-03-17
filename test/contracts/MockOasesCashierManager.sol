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
}
