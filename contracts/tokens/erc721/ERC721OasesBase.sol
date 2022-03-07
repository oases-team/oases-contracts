pragma solidity 0.8.8;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./ERC721BurnableUpgradeable.sol";
import "./ERC721DefaultApproval.sol";
import "./ERC721Lazy.sol";
import "../ContractURIUpgradeable.sol";

abstract contract ERC721OasesBase is
    OwnableUpgradeable,
    ERC721DefaultApproval,
    ERC721BurnableUpgradeable,
    ERC721Lazy,
    ContractURIUpgradeable
{
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual override(ERC721Upgradeable, ERC721DefaultApproval) returns (bool) {
        return ERC721DefaultApproval._isApprovedOrOwner(spender, tokenId);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override(ERC721DefaultApproval, ERC721Upgradeable, IERC721Upgradeable) returns (bool) {
        return ERC721DefaultApproval.isApprovedForAll(owner, operator);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, ERC721Lazy) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _mint(address to, uint256 tokenId) internal override(ERC721Lazy, ERC721Upgradeable) {
        super._mint(to, tokenId);
    }

    uint256[50] private __gap;
}
