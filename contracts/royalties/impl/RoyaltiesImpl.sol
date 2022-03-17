// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./AbstractRoyalties.sol";
import "../interfaces/Royalties.sol";

contract RoyaltiesImpl is AbstractRoyalties, Royalties {

    function getOasesRoyaltyInfos(uint256 id) override external view returns (PartLibrary.Part[] memory) {
        return royaltyInfos[id];
    }

    function _onRoyaltyInfosSet(uint256 id, PartLibrary.Part[] memory _royaltyInfos) override internal {
        emit RoyaltyInfosSet(id, _royaltyInfos);
    }
}
