// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../utils/Operators.sol";
import "../../interfaces/ITransferProxy.sol";
import "../../common_libraries/AssetLibrary.sol";
import "../../tokens/erc721/libraries/ERC721LazyMintLibrary.sol";
import "../../tokens/erc721/interfaces/IERC721LazyMint.sol";

contract ERC721LazyMintTransferProxy is Operators, ITransferProxy {
    function transfer(
        AssetLibrary.Asset memory asset,
        address from,
        address to
    )
    external
    override
    onlyOperator
    {
        require(asset.value == 1, "only 1 erc721 for lazy mint");
        (address erc721LazyMintAddress, ERC721LazyMintLibrary.ERC721LazyMintData memory lazyMintData) =
        abi.decode(asset.assetType.data, (address, ERC721LazyMintLibrary.ERC721LazyMintData));
        IERC721LazyMint(erc721LazyMintAddress).transferFromOrMint(lazyMintData, from, to);
    }
}
