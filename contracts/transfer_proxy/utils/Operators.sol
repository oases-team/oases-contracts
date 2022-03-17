// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Operators is OwnableUpgradeable {
    mapping(address => bool) operators;

    function __Operators_init() external initializer {
        __Ownable_init();
    }

    function addOperator(address operatorAddress) external onlyOwner {
        operators[operatorAddress] = true;
    }

    function removeOperator(address operatorAddress) external onlyOwner {
        operators[operatorAddress] = false;
    }

    modifier onlyOperator() {
        require(operators[_msgSender()], "Operators: caller is not the operator");
        _;
    }
}