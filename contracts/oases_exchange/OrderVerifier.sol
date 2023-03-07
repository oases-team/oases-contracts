// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../QtumTestnetEIP712Upgradeable.sol";
import "./libraries/OrderLibrary.sol";
import "./libraries/SignatureChecker.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1271Upgradeable.sol";

abstract contract OrderVerifier is
    ContextUpgradeable,
    QtumTestnetEIP712Upgradeable
{
    using AddressUpgradeable for address;

    function __OrderVerifier_init_unchained() internal onlyInitializing {
        __EIP712_init_unchained("OasesExchange", "1");
    }

    function verifyOrder(
        OrderLibrary.Order memory order,
        bytes memory signature
    ) internal view {
        if (order.salt == 0) {
            if (order.maker != address(0)) {
                require(_msgSender() == order.maker, "maker is not tx sender");
            } else {
                order.maker = _msgSender();
            }
        } else {
            if (_msgSender() != order.maker) {
                require(
                    SignatureChecker.isValidSignatureNow(
                        order.maker,
                        _hashTypedDataV4(OrderLibrary.getHash(order)),
                        signature
                    ),
                    "bad order signature verification"
                );
            }
        }
    }

    uint256[50] private __gap;
}
