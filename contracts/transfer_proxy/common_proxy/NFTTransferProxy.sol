// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../utils/Operators.sol";
import "../../interfaces/INFTTransferProxy.sol";

contract NFTTransferProxy is INFTTransferProxy, Operators {

    function __NFTTransferProxy_init() external initializer {
        __Ownable_init();
    }

    function safeTransferFromERC721(
        IERC721Upgradeable addressERC721,
        address from,
        address to,
        uint256 tokenId
    )
    external
    override
    onlyOperator
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
    onlyOperator
    {
        addressERC1155.safeTransferFrom(from, to, id, amount, data);
    }
}
