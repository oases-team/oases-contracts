// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

interface IProtocolFeeProvider {
    function getProtocolFeeBasisPoint(address owner) external view returns (uint);
}
