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
        require(totalValue < 10000, "Royalty total value should be < 10000");
        _onRoyaltiesSet(id, _royaltyInfos);
    }

    function _updateAccount(uint256 _id, address _from, address _to) internal {
        uint length = royaltyInfos[_id].length;
        for(uint i = 0; i < length; i++) {
            if (royaltyInfos[_id][i].account == _from) {
                // TODO:
                // royaltyInfos[_id][i].account = address(uint160(_to));
                royaltyInfos[_id][i].account = payable(address(uint160(_to)));
            }
        }
    }

    function _onRoyaltiesSet(uint256 id, PartLibrary.Part[] memory _royaltyInfos) virtual internal;
}