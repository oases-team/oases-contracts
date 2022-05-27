// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./interfaces/IProtocolFeeProvider.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract ProtocolFeeProvider is OwnableUpgradeable, IProtocolFeeProvider {
    // default protocol fee basis point
    uint _protocolFeeBasisPoint;

    // whether the nft has customized protocol fee bp
    mapping(address => bool) _isCustomized;
    // from nft address to its customized protocol fee bp
    mapping(address => uint) _customizedProtocolFeeBasisPoints;

    event UpdateCustomizedProtocolFeeBasisPoint(address nftAddress, uint customizedProtocolFeeBasisPoint);
    event ProtocolBasisPointChanged(uint newProtocolBasisPoint, uint preProtocolBasisPoint);

    function __ProtocolFeeProvider_init_unchained(uint protocolFeeBasisPoint) external initializer {
        __Ownable_init();
        _protocolFeeBasisPoint = protocolFeeBasisPoint;
        emit ProtocolBasisPointChanged(protocolFeeBasisPoint, 0);
    }

    function getProtocolFeeBasisPoint(
        address nftAddress,
        address owner
    ) public view returns (uint){
        if (_isCustomized[nftAddress] && IERC721Upgradeable(nftAddress).balanceOf(owner) > 0) {
            return _customizedProtocolFeeBasisPoints[nftAddress];
        }

        return _protocolFeeBasisPoint;
    }

    function setCustomizedProtocolFeeBasisPoint(address nftAddress, uint customizedProtocolFeeBasisPoint) external onlyOwner {
        _isCustomized[nftAddress] = true;
        _customizedProtocolFeeBasisPoints[nftAddress] = customizedProtocolFeeBasisPoint;
        emit UpdateCustomizedProtocolFeeBasisPoint(nftAddress, customizedProtocolFeeBasisPoint);
    }

    function setProtocolBasisPoint(uint newProtocolBasisPoint) external onlyOwner {
        uint preProtocolBasisPoint = _protocolFeeBasisPoint;
        _protocolFeeBasisPoint = newProtocolBasisPoint;
        emit ProtocolBasisPointChanged(newProtocolBasisPoint, preProtocolBasisPoint);
    }

    function getCustomizedProtocolFeeBasisPoint(address nftAddress) public view returns (uint){
        require(_isCustomized[nftAddress], "not customized");
        return _customizedProtocolFeeBasisPoints[nftAddress];
    }

    function getProtocolFeeBasisPoint() public view returns (uint){
        return _protocolFeeBasisPoint;
    }
}
