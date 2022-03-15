// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "./interfaces/Royalties.sol";
import "./libraries/RoyaltiesLibrary.sol";

abstract contract RoyaltiesUpgradeable is ERC165Upgradeable, Royalties {
    function __RoyaltiesUpgradeable_init_unchained() internal initializer {
        // TODO: check if needed
        // _registerInterface(RoyaltiesLibrary._INTERFACE_ID_ROYALTIES);
    }
}