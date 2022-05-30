// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

interface IProtocolFeeProvider {
    function getProtocolFeeBasisPoint(address nftAddress, address owner) external view returns (uint);

    function getDefaultProtocolFeeBasisPoint() external view returns (uint);
}
