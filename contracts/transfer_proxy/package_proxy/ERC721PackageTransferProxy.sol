// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../utils/Operators.sol";
import "../../interfaces/ITransferProxy.sol";
import "../../common_libraries/AssetLibrary.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract ERC721PackageTransferProxy is Operators, ITransferProxy {
    function transfer(
        AssetLibrary.Asset memory asset,
        address from,
        address to
    )
    external
    override
    onlyOperator
    {
        require(asset.value == 1, "only 1 value for erc721 package");
        (address tokenAddress, uint256[] memory tokenIds) =
        abi.decode(asset.assetType.data, (address, uint256[]));
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            IERC721Upgradeable(tokenAddress).safeTransferFrom(from, to, tokenIds[i]);
        }
    }
}
