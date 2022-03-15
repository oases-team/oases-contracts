// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../utils/Operators.sol";
import "../../interfaces/IERC20TransferProxy.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract ERC20TransferProxy is IERC20TransferProxy, Operators {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function __ERC20TransferProxy_init() external initializer {
        __Ownable_init();
    }

    function safeTransferFromERC20(
        IERC20Upgradeable addressERC20,
        address sender,
        address recipient,
        uint256 amount
    )
    external
    override
    onlyOperator
    {
        addressERC20.safeTransferFrom(sender, recipient, amount);
    }
}
