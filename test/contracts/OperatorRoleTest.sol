// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/tokens/commons/OperatorRole.sol";

contract OperatorRoleTest is OperatorRole {
    function __OperatorRoleTest_init() external initializer {
        __Ownable_init();
    }

    function getSomething() external view onlyOperator returns (uint) {
        return 10;
    }
}
