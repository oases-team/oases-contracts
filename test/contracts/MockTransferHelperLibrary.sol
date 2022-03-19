// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/oases_exchange/libraries/TransferHelperLibrary.sol";

contract MockTransferHelperLibrary {
    function transferEth(address receiver, uint256 amount) external payable {
        TransferHelperLibrary.transferEth(receiver, amount);
    }
}
