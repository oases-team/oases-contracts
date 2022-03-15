// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/interfaces/ITransferProxy.sol";
import "../../contracts/tokens/erc721/libraries/ERC721LazyMintLibrary.sol";
import "../../contracts/tokens/erc721/interfaces/IERC721LazyMint.sol";
import "./OperatorRoleTest.sol";

contract ERC721LazyMintTransferProxyTest is OperatorRoleTest, ITransferProxy {
    function transfer(AssetLibrary.Asset memory asset, address from, address to) override onlyOperator external {
        require(asset.value == 1, "erc721 value error");
        (address token, ERC721LazyMintLibrary.ERC721LazyMintData memory data) = abi.decode(asset.assetType.data, (address, ERC721LazyMintLibrary.ERC721LazyMintData));
        IERC721LazyMint(token).transferFromOrMint(data, from, to);
    }
}
