// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./mock_tokens/interfaces/ICustomERC20.sol";
import "../../contracts/interfaces/ITransferProxy.sol";

contract CustomTransferProxy is ITransferProxy {

    bytes4 constant public CUSTOM_ASSET_CLASS = bytes4(keccak256("CUSTOM_ERC20_ASSET_CLASS"));

    address immutable public customAssetAddress;

    constructor(address newCustomAssetAddress){
        customAssetAddress = newCustomAssetAddress;
    }

    function transfer(
        AssetLibrary.Asset memory asset,
        address from,
        address to
    )
    external
    override
    {
        ICustomERC20(customAssetAddress).customTransferFrom(from, to, asset.value);
    }

}