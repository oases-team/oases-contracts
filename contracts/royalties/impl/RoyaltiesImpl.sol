// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "./AbstractRoyalties.sol";
import "../interfaces/Royalties.sol";
import "../../oases_exchange/libraries/TransferHelperLibrary.sol";

contract RoyaltiesImpl is AbstractRoyalties, Royalties {
    using TransferHelperLibrary for address payable;

    function getOasesRoyaltyInfos(uint256 id) override external view returns (PartLibrary.Part[] memory) {
        return royaltyInfos[id];
    }

    function _onRoyaltyInfosSet(uint256 id, PartLibrary.Part[] memory _royaltyInfos) override internal {
        emit RoyaltyInfosSet(id, _royaltyInfos);
    }

    function transferRoyalties(uint256 tokenId, uint256 price) internal returns (uint256 rest) {
        PartLibrary.Part[] memory royaltyInfosBuffer = royaltyInfos[tokenId];
        rest = price;
        uint256 fee = 0;
        uint256 totalFeeBasisPoints = 0;
        uint256 len = royaltyInfosBuffer.length;
        for (uint256 i = 0; i < len; ++i) {
            PartLibrary.Part memory royaltyInfo = royaltyInfosBuffer[i];
            totalFeeBasisPoints += royaltyInfo.value;
            (rest, fee) = deductFeeWithBasisPoint(rest, price, royaltyInfo.value);
            if (fee > 0) {
                royaltyInfo.account.transferEth(fee);
            }
        }

        require(totalFeeBasisPoints <= 5000, "royalties sum exceeds 50%");
    }

    function deductFeeWithBasisPoint(
        uint256 value,
        uint256 price,
        uint256 basisPoint
    )
    internal
    pure
    returns (uint256 rest, uint256 realFee) {
        uint256 fee = price * basisPoint / 10000;
        if (value > fee) {
            rest = value - fee;
            realFee = fee;
        } else {
            rest = 0;
            realFee = value;
        }
    }
}
