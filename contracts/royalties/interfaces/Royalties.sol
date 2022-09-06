// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../common_libraries/PartLibrary.sol";

interface Royalties {
    event RoyaltyInfosSet(uint256 tokenId, PartLibrary.Part[] royaltyInfos);

    function getOasesRoyaltyInfos(uint256 id) external view returns (PartLibrary.Part[] memory);
}
