// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

interface ICustomERC20 {
    function customTransferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}