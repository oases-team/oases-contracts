// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract CustomERC20 is ERC20Upgradeable {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function customTransferFrom(
        address sender,
        address recipient,
        uint256 amount
    )
    external
    returns
    (bool)
    {
        // custom transfer rule
        return ERC20Upgradeable.transferFrom(sender, recipient, amount * 2);
    }
}
