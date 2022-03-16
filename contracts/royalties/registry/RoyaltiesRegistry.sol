// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../interfaces/IRoyaltiesProvider.sol";
import "../interfaces/Royalties.sol";
import "../interfaces/IERC2981.sol";
import "../libraries/RoyaltiesLibrary.sol";
import "../libraries/Royalties2981Library.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RoyaltiesRegistry is IRoyaltiesProvider, OwnableUpgradeable {

    /// @dev emitted when royalties set for token in 
    event RoyaltyInfosSetForContract(address indexed token, PartLibrary.Part[] royaltyInfos);

    /// @dev struct to store royalties in royaltyInfosByToken
    struct RoyaltyInfosSet {
        bool initialized;
        PartLibrary.Part[] royalties;
    }

    /// @dev stores royalties for token contract, set in setRoyaltyInfosByToken() method
    mapping(address => RoyaltyInfosSet) public royaltyInfosByToken;
    /// @dev stores external provider and royalties type for token contract
    mapping(address => uint256) public royaltiesProviders;

    /// @dev total amount or supported royalties types
    // 0 - royalties type is unset
    // 1 - royaltyInfosByToken
    // 2 - oases
    // 3 - external provider
    // 4 - EIP-2981
    // 5 - unsupported/nonexistent royalties type
    uint256 constant royaltiesTypesAmount = 5;

    function __RoyaltiesRegistry_init() external initializer {
        __Ownable_init_unchained();
    }

    /// @dev sets external provider for token contract, and royalties type = 3
    function setProviderByToken(address token, address provider) external {
        checkOwner(token);
        setRoyaltiesType(token, 4, provider);
    }

    /// @dev returns provider address for token contract from royaltiesProviders mapping
    function getProvider(address token) public view returns(address) {
        return address(uint160(royaltiesProviders[token]));
    }

    /// @dev returns royalties type for token contract
    function getRoyaltiesType(address token) external view returns(uint) {
        return _getRoyaltiesType(royaltiesProviders[token]);
    }

    /// @dev returns royalties type from uint
    function _getRoyaltiesType(uint256 data) internal pure returns(uint) {
        for (uint i = 1; i <= royaltiesTypesAmount; i++) {
            if (data / 2**(256-i) == 1) {
                return i;
            }
        }
        return 0;
    }

    /// @dev sets royalties type for token contract
    function setRoyaltiesType(address token, uint256 royaltiesType, address royaltiesProvider) internal {
        require(royaltiesType > 0 && royaltiesType <= royaltiesTypesAmount, "wrong royaltiesType");
        royaltiesProviders[token] = uint256(uint160(royaltiesProvider)) + 2**(256 - royaltiesType);
    }

    /// @dev clears and sets new royalties type for token contract
    function forceSetRoyaltiesType(address token, uint256 royaltiesType) external {
        checkOwner(token);
        setRoyaltiesType(token, royaltiesType, getProvider(token));
    }

    /// @dev clears royalties type for token contract
    function clearRoyaltiesType(address token) external {
        checkOwner(token);
        royaltiesProviders[token] = uint256(uint160(getProvider(token)));
    }

    /// @dev sets royalties for token contract in royaltyInfosByToken mapping and royalties type = 1
    function setRoyaltyInfosByToken(address token, PartLibrary.Part[] memory royalties) external {
        checkOwner(token);
        //clearing royaltiesProviders value for the token
        delete royaltiesProviders[token];
        // setting royaltiesType = 1 for the token
        setRoyaltiesType(token, 1, address(0));
        uint sumRoyalties = 0;
        delete royaltyInfosByToken[token];
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].account != address(0x0), "RoyaltyInfosByToken recipient should be present");
            require(royalties[i].value != 0, "Royalty value for RoyaltyInfosByToken should be > 0");
            royaltyInfosByToken[token].royalties.push(royalties[i]);
            sumRoyalties += royalties[i].value;
        }
        require(sumRoyalties < 10000, "Set by token royalties sum more, than 100%");
        royaltyInfosByToken[token].initialized = true;
        emit RoyaltyInfosSetForContract(token, royalties);
    }

    /// @dev checks if msg.sender is owner of this contract or owner of the token contract
    function checkOwner(address token) internal view {
        if ((owner() != _msgSender()) && (OwnableUpgradeable(token).owner() != _msgSender())) {
            revert("Token owner not detected");
        }
    }

    /// @dev calculates royalties type for token contract
    function calculateRoyaltiesType(address token, address royaltiesProvider) internal view returns (uint) {   
        try IERC165Upgradeable(token).supportsInterface(RoyaltiesLibrary._INTERFACE_ID_ROYALTIES) returns (bool result) {
            if (result) {
                return 2;
            }
        } catch { }
        
        try IERC165Upgradeable(token).supportsInterface(Royalties2981Library._INTERFACE_ID_ROYALTIES) returns (bool result) {
            if (result) {
                return 4;
            }
        } catch { }
        
        if (royaltiesProvider != address(0)) {
            return 3;
        }

        if (royaltyInfosByToken[token].initialized) {
            return 1;
        }

        return 5;
    }

    /// @dev returns royaltyInfos for token contract and token id
    function getRoyaltyInfos(address token, uint tokenId) override external returns (PartLibrary.Part[] memory) {
        uint royaltiesProviderData = royaltiesProviders[token];

        address royaltiesProvider = address(uint160(royaltiesProviderData));
        uint royaltiesType = _getRoyaltiesType(royaltiesProviderData);

        // case when royaltiesType is not set
        if (royaltiesType == 0) {
            // calculating royalties type for token
            royaltiesType = calculateRoyaltiesType(token, royaltiesProvider);
            
            //saving royalties type
            setRoyaltiesType(token, royaltiesType, royaltiesProvider);
        }

        //case royaltiesType = 1, royalties are set in royaltyInfosByToken
        if (royaltiesType == 1) {
            return royaltyInfosByToken[token].royalties;
        }

        //case royaltiesType = 2, royalties Oases
        if (royaltiesType == 2) {
            return getRoyaltiesOases(token, tokenId);
        }

        //case royaltiesType = 3, royalties from external provider
        if (royaltiesType == 3) {
            return providerExtractor(token, tokenId, royaltiesProvider);
        }

        //case royaltiesType = 4, royalties EIP-2981
        if (royaltiesType == 4) {
            return getRoyaltiesEIP2981(token, tokenId);
        }

        // case royaltiesType = 5, unknown/empty royalties
        if (royaltiesType == 5) {
            return new PartLibrary.Part[](0);
        } 

        revert("error in getRoyalties");
    }

    /// @dev tries to get royalties Oases for token and tokenId
    function getRoyaltiesOases(address token, uint tokenId) internal view returns (PartLibrary.Part[] memory) {
        try Royalties(token).getOasesRoyaltyInfos(tokenId) returns (PartLibrary.Part[] memory result) {
            return result;
        } catch {
            return new PartLibrary.Part[](0);
        }
    }


    /// @dev tries to get royalties EIP-2981 for token and tokenId
    function getRoyaltiesEIP2981(address token, uint tokenId) internal view returns (PartLibrary.Part[] memory) {
        try IERC2981(token).royaltyInfo(tokenId, Royalties2981Library._WEIGHT_VALUE) returns (address receiver, uint256 royaltyAmount) {
            return Royalties2981Library.calculateRoyalties(receiver, royaltyAmount);
        } catch {
            return new PartLibrary.Part[](0);
        }
    }

    /// @dev tries to get royalties for token and tokenId from external provider set in royaltiesProviders
    function providerExtractor(address token, uint tokenId, address providerAddress) internal returns (PartLibrary.Part[] memory) {
        try IRoyaltiesProvider(providerAddress).getRoyaltyInfos(token, tokenId) returns (PartLibrary.Part[] memory result) {
            return result;
        } catch {
            return new PartLibrary.Part[](0);
        }
    }

    uint256[46] private __gap;
}
