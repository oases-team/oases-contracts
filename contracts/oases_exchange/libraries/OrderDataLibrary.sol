// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../common_libraries/PartLibrary.sol";

library OrderDataLibrary {

    struct Data {
        PartLibrary.Part[] payoutInfos;
        // explicit royalty infos
        PartLibrary.Part[] royaltyInfos;
        PartLibrary.Part[] originFeeInfos;
        bool isMakeFill;
    }

    bytes4 constant public V1 = bytes4(keccak256("V1"));

    function decodeData(bytes memory dataBytes) internal pure returns (Data memory){
        return abi.decode(dataBytes, (Data));
    }
}
