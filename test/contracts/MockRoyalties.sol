// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../../contracts/royalties/interfaces/Royalties.sol";

contract MockRoyalties {
    Royalties immutable royalties;

    constructor(Royalties _royalties) {
        royalties = _royalties;
    }

    event Test(address account, uint value);

    function royaltiesTest(uint id) public {
        PartLibrary.Part[] memory result = royalties.getOasesRoyaltyInfos(id);

        for (uint i = 0; i < result.length; i++) {
            emit Test(result[i].account, result[i].value);
        }
    }
}
