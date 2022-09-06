// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../common_libraries/PartLibrary.sol";

abstract contract AbstractRoyalties {
    mapping (uint256 => PartLibrary.Part[]) internal royaltyInfos;

    function _saveRoyaltyInfos(uint256 id, PartLibrary.Part[] memory _royaltyInfos) internal {
        uint256 totalValue;
        uint length = _royaltyInfos.length;
        for (uint i = 0; i < length; i++) {
            require(_royaltyInfos[i].account != address(0x0), "Recipient should not be empty");
            require(_royaltyInfos[i].value != 0, "Royalty value should be valid");
            totalValue += _royaltyInfos[i].value;
            royaltyInfos[id].push(_royaltyInfos[i]);
        }
        require(totalValue <= 5000, "royalties sum exceeds 50%");
        _onRoyaltyInfosSet(id, _royaltyInfos);
    }

    function _updateAccount(uint256 _id, address _from, address _to) internal {
        uint length = royaltyInfos[_id].length;
        for(uint i = 0; i < length; i++) {
            if (royaltyInfos[_id][i].account == _from) {
                royaltyInfos[_id][i].account = payable(_to);
            }
        }
    }

    function _onRoyaltyInfosSet(uint256 id, PartLibrary.Part[] memory _royaltyInfos) virtual internal;
}
