// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./interfaces/IProtocolFeeProvider.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract ProtocolFeeProvider is OwnableUpgradeable, IProtocolFeeProvider {
    // default protocol fee basis point
    uint _defaultProtocolFeeBasisPoint;
    uint _memberCardProtocolFeeBasisPoint;
    address _memberCardNFTAddress;

    event MemberCardNFTAddressChanged(address newMemberCardNFTAddress, address preMemberCardNFTAddress);
    event MemberCardProtocolFeeBasisPointChanged(uint newMemberCardProtocolFeeBasisPoint, uint preMemberCardProtocolFeeBasisPoint);
    event DefaultProtocolFeeBasisPointChanged(uint newDefaultProtocolFeeBasisPoint, uint preDefaultProtocolFeeBasisPoint);

    function __ProtocolFeeProvider_init(uint defaultProtocolFeeBasisPoint) external initializer {
        __Ownable_init();
        _defaultProtocolFeeBasisPoint = defaultProtocolFeeBasisPoint;
        emit DefaultProtocolFeeBasisPointChanged(defaultProtocolFeeBasisPoint, 0);
    }

    function getProtocolFeeBasisPoint(address owner) public view returns (uint){
        address memberCardNFTAddress = _memberCardNFTAddress;
        // member card NFT contract will not be deployed at once
        if (memberCardNFTAddress != address(0) && IERC721Upgradeable(memberCardNFTAddress).balanceOf(owner) > 0) {
            return _memberCardProtocolFeeBasisPoint;
        }

        return _defaultProtocolFeeBasisPoint;
    }

    function setMemberCardProtocolFeeBasisPoint(uint newMemberCardProtocolFeeBasisPoint) external onlyOwner {
        require(newMemberCardProtocolFeeBasisPoint <= _defaultProtocolFeeBasisPoint, "invalid mc fee pb");
        uint preMemberCardProtocolFeeBasisPoint = _memberCardProtocolFeeBasisPoint;
        _memberCardProtocolFeeBasisPoint = newMemberCardProtocolFeeBasisPoint;
        emit MemberCardProtocolFeeBasisPointChanged(newMemberCardProtocolFeeBasisPoint, preMemberCardProtocolFeeBasisPoint);
    }

    function setMemberCardNFTAddress(address newMemberCardNFTAddress) external onlyOwner {
        address preMemberCardNFTAddress = _memberCardNFTAddress;
        _memberCardNFTAddress = newMemberCardNFTAddress;
        emit MemberCardNFTAddressChanged(newMemberCardNFTAddress, preMemberCardNFTAddress);
    }

    function setDefaultProtocolFeeBasisPoint(uint newDefaultProtocolFeeBasisPoint) external onlyOwner {
        uint preDefaultProtocolFeeBasisPoint = _defaultProtocolFeeBasisPoint;
        _defaultProtocolFeeBasisPoint = newDefaultProtocolFeeBasisPoint;
        emit DefaultProtocolFeeBasisPointChanged(newDefaultProtocolFeeBasisPoint, preDefaultProtocolFeeBasisPoint);
    }

    function getMemberCardProtocolFeeBasisPoint() public view returns (uint){
        return _memberCardProtocolFeeBasisPoint;
    }

    function getMemberCardNFTAddress() public view returns (address){
        return _memberCardNFTAddress;
    }

    function getDefaultProtocolFeeBasisPoint() public view returns (uint){
        return _defaultProtocolFeeBasisPoint;
    }

    uint256[50] private __gap;
}
