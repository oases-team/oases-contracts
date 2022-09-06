// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/interfaces/INFTTransferProxy.sol";

contract MockTransferProxy is INFTTransferProxy {

    function safeTransferFromERC721(IERC721Upgradeable token, address from, address to, uint256 tokenId) override external {
        token.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFromERC1155(IERC1155Upgradeable token, address from, address to, uint256 id, uint256 value, bytes calldata data) override external {
        token.safeTransferFrom(from, to, id, value, data);
    }
}
