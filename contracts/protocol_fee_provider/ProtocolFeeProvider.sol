// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./interfaces/IProtocolFeeProvider.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract ProtocolFeeProvider is OwnableUpgradeable, IProtocolFeeProvider {
    // default protocol fee basis point
    uint _defaultProtocolFeeBasisPoint;
    uint _memberCardProtocolFeeBasisPoints;
    address _memberCardNFTAddress;

    event MemberCardNFTAddressChanged(address newMemberCardNFTAddress, address preMemberCardNFTAddress);
    event MemberCardProtocolFeeBasisPointsChanged(uint newMemberCardProtocolFeeBasisPoints, uint preMemberCardProtocolFeeBasisPoints);
    event DefaultProtocolBasisPointChanged(uint newDefaultProtocolBasisPoint, uint preDefaultProtocolBasisPoint);

    function __ProtocolFeeProvider_init_unchained(uint defaultProtocolFeeBasisPoint) external initializer {
        __Ownable_init();
        _defaultProtocolFeeBasisPoint = defaultProtocolFeeBasisPoint;
        emit DefaultProtocolBasisPointChanged(defaultProtocolFeeBasisPoint, 0);
    }

    function getProtocolFeeBasisPoint(address owner) public view returns (uint){
        if (IERC721Upgradeable(_memberCardNFTAddress).balanceOf(owner) > 0) {
            return _memberCardProtocolFeeBasisPoints;
        }

        return _defaultProtocolFeeBasisPoint;
    }

    function setMemberCardProtocolFeeBasisPoints(uint newMemberCardProtocolFeeBasisPoints) external onlyOwner {
        uint preMemberCardProtocolFeeBasisPoints = _memberCardProtocolFeeBasisPoints;
        _memberCardProtocolFeeBasisPoints = newMemberCardProtocolFeeBasisPoints;
        emit MemberCardProtocolFeeBasisPointsChanged(newMemberCardProtocolFeeBasisPoints, preMemberCardProtocolFeeBasisPoints);
    }

    function setMemberCardNFTAddress(address newMemberCardNFTAddress) external onlyOwner {
        address preMemberCardNFTAddress = _memberCardNFTAddress;
        _memberCardNFTAddress = newMemberCardNFTAddress;
        emit MemberCardNFTAddressChanged(newMemberCardNFTAddress, preMemberCardNFTAddress);
    }

    function setDefaultProtocolBasisPoint(uint newDefaultProtocolBasisPoint) external onlyOwner {
        uint preDefaultProtocolBasisPoint = _defaultProtocolFeeBasisPoint;
        _defaultProtocolFeeBasisPoint = newDefaultProtocolBasisPoint;
        emit DefaultProtocolBasisPointChanged(newDefaultProtocolBasisPoint, preDefaultProtocolBasisPoint);
    }

    function getMemberCardProtocolFeeBasisPoints() public view returns (uint){
        return _memberCardProtocolFeeBasisPoints;
    }

    function getDefaultProtocolFeeBasisPoint() public view returns (uint){
        return _defaultProtocolFeeBasisPoint;
    }

    uint256[50] private __gap;
}
