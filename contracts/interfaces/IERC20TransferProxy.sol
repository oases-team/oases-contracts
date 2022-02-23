// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IERC20TransferProxy {
    function safeTransferFromERC20(
        IERC20Upgradeable addressERC20,
        address sender,
        address recipient,
        uint256 amount
    ) external;
}
