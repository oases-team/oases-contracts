// SPDX-License-Identifier: MIT

pragma solidity >=0.6.2 <0.8.0;
pragma abicoder v2;

import "../../common_libraries/PartLibrary.sol";

interface Royalties {
    event RoyaltiesSet(uint256 tokenId, PartLibrary.Part[] royalties);

    function getOasesRoyalties(uint256 id) external view returns (PartLibrary.Part[] memory);
}
