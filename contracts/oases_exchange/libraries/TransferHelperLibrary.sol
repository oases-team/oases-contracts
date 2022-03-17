// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

library TransferHelperLibrary {
    // helpful library for transfer from contract to an address as the receiver
    function transferEth(address receiver, uint256 amount) internal {
        (bool success,) = receiver.call{value: amount}("");
        require(success, "bad eth transfer");
    }
}
