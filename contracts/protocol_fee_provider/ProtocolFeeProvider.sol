// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "./interfaces/IProtocolFeeProvider.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract ProtocolFeeProvider is OwnableUpgradeable, IProtocolFeeProvider {
    // default protocol fee basis point
    uint _defaultProtocolFeeBasisPoint;

    // whether the nft has customized protocol fee bp
    mapping(address => bool) _isCustomized;
    // from nft address to its customized protocol fee bp
    mapping(address => uint) _customizedProtocolFeeBasisPoints;

    event UpdateCustomizedProtocolFeeBasisPoint(address nftAddress, bool isAdded, uint customizedProtocolFeeBasisPoint);
    event DefaultProtocolBasisPointChanged(uint newDefaultProtocolBasisPoint, uint preDefaultProtocolBasisPoint);

    function __ProtocolFeeProvider_init_unchained(uint defaultProtocolFeeBasisPoint) external initializer {
        __Ownable_init();
        _defaultProtocolFeeBasisPoint = defaultProtocolFeeBasisPoint;
        emit DefaultProtocolBasisPointChanged(defaultProtocolFeeBasisPoint, 0);
    }

    function getProtocolFeeBasisPoint(
        address nftAddress,
        address owner
    ) public view returns (uint){
        if (_isCustomized[nftAddress] && IERC721Upgradeable(nftAddress).balanceOf(owner) > 0) {
            return _customizedProtocolFeeBasisPoints[nftAddress];
        }

        return _defaultProtocolFeeBasisPoint;
    }

    // add or remove
    function setCustomizedProtocolFeeBasisPoint(address nftAddress, bool isAdded, uint customizedProtocolFeeBasisPoint) external onlyOwner {
        _isCustomized[nftAddress] = isAdded;
        if (isAdded) {
            _customizedProtocolFeeBasisPoints[nftAddress] = customizedProtocolFeeBasisPoint;
        } else {
            customizedProtocolFeeBasisPoint = 0;
            delete _customizedProtocolFeeBasisPoints[nftAddress];
        }

        emit UpdateCustomizedProtocolFeeBasisPoint(nftAddress, isAdded, customizedProtocolFeeBasisPoint);
    }

    function setDefaultProtocolBasisPoint(uint newDefaultProtocolBasisPoint) external onlyOwner {
        uint preDefaultProtocolBasisPoint = _defaultProtocolFeeBasisPoint;
        _defaultProtocolFeeBasisPoint = newDefaultProtocolBasisPoint;
        emit DefaultProtocolBasisPointChanged(newDefaultProtocolBasisPoint, preDefaultProtocolBasisPoint);
    }

    function getCustomizedProtocolFeeBasisPoint(address nftAddress) public view returns (uint){
        require(_isCustomized[nftAddress], "not customized");
        return _customizedProtocolFeeBasisPoints[nftAddress];
    }

    function getDefaultProtocolFeeBasisPoint() public view returns (uint){
        return _defaultProtocolFeeBasisPoint;
    }
}
