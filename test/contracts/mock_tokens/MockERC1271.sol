// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./ERC1271.sol";

contract MockERC1271 is ERC1271Oases {

    bool private returnSuccessfulValidSignature;

    function setReturnSuccessfulValidSignature(bool value) public {
        returnSuccessfulValidSignature = value;
    }

    function isValidSignature(bytes32, bytes memory) public override view returns (bytes4) {
        return returnSuccessfulValidSignature ? ERC1271_RETURN_VALID_SIGNATURE : ERC1271_RETURN_INVALID_SIGNATURE;
    }
}