// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../../contracts/interfaces/ITransferProxy.sol";
import "../../contracts/common_libraries/AssetLibrary.sol";

contract MockOldERC721TransferProxy is ITransferProxy {

    function transfer(
        AssetLibrary.Asset memory asset, 
        address from, 
        address to)
    external
    override 
    {
        (address addressERC721, uint256 tokenId) = abi.decode(asset.assetType.data, (address, uint256));
        IERC721Upgradeable(addressERC721).transferFrom(from, to, tokenId);
    }
}
