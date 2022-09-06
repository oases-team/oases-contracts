// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/interfaces/INFTTransferProxy.sol";

contract MockNFTTransferProxy is INFTTransferProxy {

    function safeTransferFromERC721(
        IERC721Upgradeable addressERC721,
        address from,
        address to,
        uint256 tokenId
    )
    external
    override
    {
        addressERC721.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFromERC1155(
        IERC1155Upgradeable addressERC1155,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    )
    external
    override
    {
        addressERC1155.safeTransferFrom(from, to, id, amount, data);
    }
}