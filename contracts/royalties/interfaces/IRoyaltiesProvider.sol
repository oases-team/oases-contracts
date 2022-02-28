// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../common_libraries/PartLibrary.sol";

interface IRoyaltiesProvider {
    function getRoyaltyInfos(address tokenAddress, uint256 tokenId) external returns (PartLibrary.Part[] memory);
}
