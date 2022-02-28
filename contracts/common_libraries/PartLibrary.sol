// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

library PartLibrary {

    struct Part {
        address payable account;
        uint96 value;
    }

    bytes32 public constant PART_TYPEHASH = keccak256("Part(address account,uint96 value)");

    function getHash(Part memory part) internal pure returns (bytes32){
        return keccak256(
            abi.encode(PART_TYPEHASH, part.account, part.value)
        );
    }
}
