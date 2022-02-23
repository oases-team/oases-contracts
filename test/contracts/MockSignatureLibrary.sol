// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/common_libraries/SignatureLibrary.sol";

contract MockSignatureLibrary {
    using SignatureLibrary for bytes32;

    function recoverWithSignature(bytes32 hash, bytes memory signature) external pure returns (address){
        return hash.recover(signature);
    }

    function recoverWithSplitSignatureParams(bytes32 hash, uint8 v, bytes32 r, bytes32 s) external pure returns (address){
        return hash.recover(v, r, s);
    }
}
