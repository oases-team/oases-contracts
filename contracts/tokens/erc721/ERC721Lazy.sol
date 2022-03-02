// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./ERC721Upgradeable.sol";
// TODO: link to Oases royalties contract
import "../../royalties/contracts/impl/RoyaltiesV2Impl.sol";
import "../../royalties-upgradeable/contracts/RoyaltiesV2Upgradeable.sol";

import "./interfaces/IERC721LazyMint.sol";
import "../Mint721Validator.sol";

// TODO: change base contract
abstract contract ERC721Lazy is
    IERC721LazyMint,
    ERC721Upgradeable,
    Mint721Validator,
    RoyaltiesV2Upgradeable,
    RoyaltiesV2Impl
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToAddressMap;

    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    bytes4 private constant _INTERFACE_ID_ERC721_ENUMERABLE = 0x780e9d63;

    // tokenId => creatorInfos
    mapping(uint256 => PartLibrary.Part[]) private creatorInfos;

    function __ERC721Lazy_init_unchained() internal initializer {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC165Upgradeable, ERC165Upgradeable)
        returns (bool)
    {
        // TODO:  change LibRoyaltiesV2 later
        return
            interfaceId ==
            ERC721LazyMintLibrary._INTERFACE_ID_MINT_AND_TRANSFER ||
            interfaceId == LibRoyaltiesV2._INTERFACE_ID_ROYALTIES ||
            interfaceId == _INTERFACE_ID_ERC165 ||
            interfaceId == _INTERFACE_ID_ERC721 ||
            interfaceId == _INTERFACE_ID_ERC721_METADATA ||
            interfaceId == _INTERFACE_ID_ERC721_ENUMERABLE;
    }

    function transferFromOrMint(
        ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData,
        address from,
        address to
    ) external override {
        if (_exists(erc721LazyMintData.tokenId)) {
            safeTransferFrom(from, to, erc721LazyMintData.tokenId);
        } else {
            mintAndTransfer(erc721LazyMintData, to);
        }
    }

    function mintAndTransfer(
        ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData,
        address to
    ) public virtual override {
        address minter = address(erc721LazyMintData.tokenId >> 96);
        address sender = _msgSender();

        require(
            minter == erc721LazyMintData.creatorInfos[0].account,
            "tokenId incorrect"
        );
        require(
            erc721LazyMintData.creatorInfos.length ==
                erc721LazyMintData.signatures.length
        );
        require(
            minter == sender || isApprovedForAll(minter, sender),
            "ERC721: transfer caller is not owner nor approved"
        );

        bytes32 hash = ERC721LazyMintLibrary.getHash(erc721LazyMintData);
        for (uint256 i = 0; i < erc721LazyMintData.creatorInfos.length; ++i) {
            address creator = erc721LazyMintData.creatorInfos[i].account;
            if (creator != sender) {
                validate(creator, hash, creatorInfos.signatures[i]);
            }
        }

        _safeMint(to, erc721LazyMintData.tokenId);
        // TODO: check
        _saveRoyalties(
            erc721LazyMintData.tokenId,
            erc721LazyMintData.royaltyInfos
        );
        _saveCreatorInfos(
            erc721LazyMintData.tokenId,
            erc721LazyMintData.creatorInfos
        );
        _setTokenURI(erc721LazyMintData.tokenId, erc721LazyMintData.tokenURI);
    }

    function _mint(address to, uint256 tokenId) internal virtual override {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_burned(tokenId), "token already burned");
        require(!_exists(tokenId), "ERC721: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId);

        _holderTokens[to].add(tokenId);

        _tokenOwners.set(tokenId, to);

        address minter = address(tokenId >> 96);
        if (minter != to) {
            emit Transfer(address(0), minter, tokenId);
            emit Transfer(minter, to, tokenId);
        } else {
            emit Transfer(address(0), to, tokenId);
        }
    }

    function _saveCreatorInfos(
        uint256 tokenId,
        PartLibrary.Part[] memory _creatorInfos
    ) internal {
        PartLibrary.Part[] storage creatorInfosOfToken = creatorInfos[tokenId];
        uint256 total = 0;
        for (uint256 i = 0; i < _creatorInfos.length; i++) {
            require(
                _creatorInfos[i].account != address(0x0),
                "Account should be present"
            );
            require(
                _creatorInfos[i].value != 0,
                "Creator share should be positive"
            );
            creatorInfosOfToken.push(_creatorInfos[i]);
            total = total + _creatorInfos[i].value;
        }
        require(
            total == 10000,
            "total amount of creatorInfos share should be 10000"
        );
        emit CreatorInfos(tokenId, _creatorInfos);
    }

    function updateAccount(
        uint256 _id,
        address _from,
        address _to
    ) external {
        require(_msgSender() == _from, "not allowed");
        super._updateAccount(_id, _from, _to);
    }

    function getCreatorInfos(uint256 _id)
        external
        view
        returns (LibPart.Part[] memory)
    {
        return creatorInfos[_id];
    }

    uint256[50] private __gap;
}
