// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";

contract QtumTestnetEIP712Upgradeable is EIP712Upgradeable {
    bytes32 private constant _TYPE_HASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    function _hashTypedDataV4(
        bytes32 structHash
    ) internal view virtual override returns (bytes32) {
        return
            ECDSAUpgradeable.toTypedDataHash(
                keccak256(
                    abi.encode(
                        _TYPE_HASH,
                        _EIP712NameHash(),
                        _EIP712VersionHash(),
                        0x22b9, // fuck
                        address(this)
                    )
                ),
                structHash
            );
    }
}
