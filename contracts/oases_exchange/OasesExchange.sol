// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./OasesMatchingCore.sol";
import "./OasesCashierManager.sol";

contract OasesExchange is OasesMatchingCore, OasesCashierManager {
    function __OasesExchange_init(
        address newDefaultFeeReceiver,
        IProtocolFeeProvider newProtocolFeeProviderAddress,
        IERC20TransferProxy newERC20TransferProxyAddress,
        INFTTransferProxy newNFTTransferProxyAddress
    )
    external
    initializer {
        __Ownable_init_unchained();
        __Cashier_init_unchained(
            newERC20TransferProxyAddress,
            newNFTTransferProxyAddress
        );
        __OasesCashierManager_init_unchained(
            newDefaultFeeReceiver,
            newProtocolFeeProviderAddress
        );
        __OrderVerifier_init_unchained();
    }
}
