// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../contracts/interfaces/IERC20TransferProxy.sol";

contract MockERC20TransferProxy is IERC20TransferProxy {

    function safeTransferFromERC20(
        IERC20Upgradeable addressERC20,
        address sender,
        address recipient,
        uint256 amount
    )
    external
    override
    {
        require(addressERC20.transferFrom(sender, recipient, amount), "bad erc20 transfer");
    }
}

