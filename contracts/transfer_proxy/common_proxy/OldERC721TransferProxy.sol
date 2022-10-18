// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../utils/Operators.sol";
import "../../interfaces/ITransferProxy.sol";
import "../../common_libraries/AssetLibrary.sol";

contract OldERC721TransferProxy is ITransferProxy, Operators {

    function __OldERC721TransferProxy_init() external initializer {
        __Ownable_init();
    }

    function transfer(
        AssetLibrary.Asset memory asset, 
        address from, 
        address to)
    external
    override
    onlyOperator 
    {
        (address addressERC721, uint256 tokenId) = abi.decode(asset.assetType.data, (address, uint256));
        IERC721Upgradeable(addressERC721).transferFrom(from, to, tokenId);
    }
}
