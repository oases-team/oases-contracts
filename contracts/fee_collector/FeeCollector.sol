// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract FeeCollector is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // initializer
    function __FeeCollector_init() external initializer {
        __Ownable_init_unchained();
    }

    // withdraw
    function withdraw(
        address token,
        address to,
        uint amount
    ) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20Upgradeable(token).transfer(to, amount);
        }
    }

    // fallback to receive fees
    receive() external payable {}

    uint256[50] private __gap;
}
