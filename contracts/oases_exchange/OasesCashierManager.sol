// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./interfaces/ICashierManager.sol";
import "../common_libraries/AssetLibrary.sol";
import "./libraries/BasisPointLibrary.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract OasesCashierManager is OwnableUpgradeable, ICashierManager {
    using BasisPointLibrary for uint256;

    uint256 protocolFeeBasisPoint;
    mapping(address => address) feeReceivers;
    address defaultFeeReceiver;
    IRoyaltiesProvider royaltiesRegistry;

    function __OasesCashierManager_init_unchained(
        uint256 newProtocolFeeBasisPoint,
        address newDefaultFeeReceiver,
        address newRoyaltiesRegistryAddress
    ) internal initializer {
        protocolFeeBasisPoint = newProtocolFeeBasisPoint;
        defaultFeeReceiver = newDefaultFeeReceiver;
        royaltiesRegistry = IRoyaltiesProvider(newRoyaltiesRegistryAddress);
    }

    // set basis point of protocol fee by the owner
    function setProtocolFeeBasisPoint(uint256 newProtocolFeeBasisPoint) external onlyOwner {
        protocolFeeBasisPoint = newProtocolFeeBasisPoint;
    }

    // set royalties registry address by the owner
    function setRoyaltiesRegistry(address newRoyaltiesRegistry) external onlyOwner {
        royaltiesRegistry = IRoyaltiesProvider(newRoyaltiesRegistry);
    }

    // get basis point of protocol fee
    function getProtocolFeeBasisPoint() public view returns (uint256){
        return protocolFeeBasisPoint;
    }

    // get the address of royalties registry
    function getRoyaltiesRegistry() public view returns (address){
        return address(royaltiesRegistry);
    }

    // get fee receiver address by asset address
    function getFeeReceiver(address assetAddress) public view returns (address){
        address receiverAddress = feeReceivers[assetAddress];
        if (receiverAddress != address(0)) {
            return receiverAddress;
        }

        return defaultFeeReceiver;
    }

    function deductFeeWithBasisPoint(
        uint256 value,
        uint256 amountToCalculate,
        uint256 feeBasisPoint
    )
    internal
    pure
    returns
    (uint256 rest, uint256 realFee){
        uint256 fee = amountToCalculate.basisPointCalculate(feeBasisPoint);
        if (value > fee) {
            rest = value - fee;
            realFee = fee;
        } else {
            rest = 0;
            realFee = value;
        }
    }
}
