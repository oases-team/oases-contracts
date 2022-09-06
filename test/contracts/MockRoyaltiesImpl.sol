// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/royalties/impl/RoyaltiesImpl.sol";

contract MockRoyaltiesImpl is RoyaltiesImpl {
    function saveRoyaltyInfos(uint256 id, PartLibrary.Part[] memory royalties) external {
        _saveRoyaltyInfos(id, royalties);
    }

    function updateAccount(uint256 id, address from, address to) external {
        _updateAccount(id, from, to);
    }
}
