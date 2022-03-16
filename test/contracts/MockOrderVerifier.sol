// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/OrderVerifier.sol";
import "../../contracts/oases_exchange/libraries/OrderLibrary.sol";

contract MockOrderVerifier is OrderVerifier {
    function __MockOrderVerifier_init() external initializer {
        __OrderVerifier_init_unchained();
    }

    function mockVerifyOrder(OrderLibrary.Order calldata order, bytes calldata signature) external view {
        verifyOrder(order, signature);
    }
}
