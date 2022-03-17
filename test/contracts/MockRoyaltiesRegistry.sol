// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/royalties/interfaces/IRoyaltiesProvider.sol";
import "../../contracts/common_libraries/PartLibrary.sol";
import "../../contracts/royalties/interfaces/IERC2981.sol";
import "../../contracts/royalties/libraries/Royalties2981Library.sol";

import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

contract MockRoyaltiesRegistry is IRoyaltiesProvider {

    struct RoyaltiesSet {
        bool initialized;
        PartLibrary.Part[] royalties;
    }

    mapping(bytes32 => RoyaltiesSet) public royaltiesByTokenAndTokenId;
    mapping(address => RoyaltiesSet) public royaltiesByToken;

    function setRoyaltiesByToken(address token, PartLibrary.Part[] memory royalties) external {
        uint sumRoyalties = 0;
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].account != address(0x0), "RoyaltiesByToken recipient should be present");
            require(royalties[i].value != 0, "Fee value for RoyaltiesByToken should be > 0");
            royaltiesByToken[token].royalties.push(royalties[i]);
            sumRoyalties += royalties[i].value;
        }
        require(sumRoyalties < 10000, "Set by token royalties sum more, than 100%");
        royaltiesByToken[token].initialized = true;
    }

    function setRoyaltiesByTokenAndTokenId(
        address token,
        uint tokenId,
        PartLibrary.Part[] memory royalties
    )
    external
    {
        setRoyaltiesCacheByTokenAndTokenId(token, tokenId, royalties);
    }

    function getRoyaltyInfos(address token, uint tokenId) view override external returns (PartLibrary.Part[] memory) {
        RoyaltiesSet memory royaltiesSet = royaltiesByTokenAndTokenId[keccak256(abi.encode(token, tokenId))];
        if (royaltiesSet.initialized) {
            return royaltiesSet.royalties;
        }
        royaltiesSet = royaltiesByToken[token];
        if (royaltiesSet.initialized) {
            return royaltiesSet.royalties;
        } else if (IERC165Upgradeable(token).supportsInterface(Royalties2981Library._INTERFACE_ID_ROYALTIES)) {
            IERC2981 v2981 = IERC2981(token);
            try v2981.royaltyInfo(tokenId, Royalties2981Library._WEIGHT_VALUE) returns (address receiver, uint256 royaltyAmount) {
                return Royalties2981Library.calculateRoyalties(receiver, royaltyAmount);
            } catch {}
        }
        return royaltiesSet.royalties;
    }

    function setRoyaltiesCacheByTokenAndTokenId(
        address token,
        uint256 tokenId,
        PartLibrary.Part[] memory royalties
    )
    internal
    {
        uint256 sumRoyalties = 0;
        bytes32 key = keccak256(abi.encode(token, tokenId));
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].account != address(0x0), "RoyaltiesByTokenAndTokenId recipient should be present");
            require(royalties[i].value != 0, "Fee value for RoyaltiesByTokenAndTokenId should be > 0");
            royaltiesByTokenAndTokenId[key].royalties.push(royalties[i]);
            sumRoyalties += royalties[i].value;
        }
        require(sumRoyalties < 10000, "Set by token and tokenId royalties sum more, than 100%");
        royaltiesByTokenAndTokenId[key].initialized = true;
    }

    uint256[46] private __gap;
}
