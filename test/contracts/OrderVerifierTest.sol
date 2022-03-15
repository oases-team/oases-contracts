// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/common_libraries/SignatureLibrary.sol";
import "../../contracts/oases_exchange/libraries/OrderLibrary.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1271Upgradeable.sol";


abstract contract OrderVerifierTest is ContextUpgradeable, EIP712Upgradeable {
    using SignatureLibrary for bytes32;
    using AddressUpgradeable for address;

    // bytes4(keccak256("isValidSignature(bytes32,bytes)"))
    bytes4 constant internal MAGIC_VALUE = 0x1626ba7e;

    function __OrderVerifier_init_unchained() internal onlyInitializing {
        __EIP712_init_unchained("OasesExchange", "1");
    }

    event Signer(address signer, address maker);

    function verifyOrder(OrderLibrary.Order memory order, bytes memory signature) internal view returns (address, address){
        if (order.salt == 0) {
            if (order.maker != address(0)) {
                require(_msgSender() == order.maker, "maker is not tx sender");
            } else {
                order.maker = _msgSender();
            }
        } else {
            if (_msgSender() != order.maker) {
                bytes32 orderHash = OrderLibrary.getHash(order);
                address signer;
                if (signature.length == 65) {
                    signer = _hashTypedDataV4(orderHash).recover(signature);
                }
                return (signer, order.maker);
                //                if (signer != order.maker) {
                //                    require(
                //                        order.maker.isContract(),
                //                        "bad order signature verification"
                //                    );
                //
                //                    require(
                //                        IERC1271Upgradeable(order.maker).isValidSignature(
                //                            _hashTypedDataV4(orderHash),
                //                            signature
                //                        ) == MAGIC_VALUE,
                //                        "bad signature verification for contract"
                //                    );
                //                }
            }

        }
    }

    uint256[50] private __gap;
}
