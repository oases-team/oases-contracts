// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/tokens/erc721/libraries/ERC721LazyMintLibrary.sol";

contract MockERC721LazyMintLibrary {
    function getHash(ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData) external pure returns (bytes32) {
        return ERC721LazyMintLibrary.getHash(erc721LazyMintData);
    }
}
