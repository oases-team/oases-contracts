// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/Cashier.sol";

contract MockCashier is Cashier {

    function __MockCashier_init(IERC20TransferProxy erc20TransferProxy, INFTTransferProxy nftTransferProxy) external initializer {
        __Ownable_init_unchained();
        __Cashier_init_unchained(erc20TransferProxy, nftTransferProxy);
    }

    function transfer(AssetLibrary.Asset calldata asset, address from, address to) payable external {
        Cashier.transfer(asset, from, to, 0x00000000, 0x00000000);
    }
}

