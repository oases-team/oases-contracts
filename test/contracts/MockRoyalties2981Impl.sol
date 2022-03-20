// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/royalties/interfaces/IERC2981.sol";
import "../../contracts/royalties/libraries/Royalties2981Library.sol";
import "../../contracts/common_libraries/PartLibrary.sol";

contract MockRoyalties2981Impl is IERC2981 {

    function royaltyInfo(uint256 _tokenId, uint256 _salePrice) override external view returns (address receiver, uint256 royaltyAmount) {
        receiver = address(uint160(_tokenId >> 96));
        royaltyAmount = _salePrice/10;
    }

    function calculateRoyaltiesTest(address payable to, uint96 amount) external returns (PartLibrary.Part[] memory) {
        return Royalties2981Library.calculateRoyalties(to, amount);
    }
}
