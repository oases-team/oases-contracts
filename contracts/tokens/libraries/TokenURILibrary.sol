// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

library TokenURILibrary {
    /// checks if _tokenURI starts with base. if true returns _tokenURI, else base + _tokenURI
    function checkPrefix(
        string memory base, 
        string memory _tokenURI
    )
    internal
    pure
    returns (string memory)
    {
        bytes memory baseBytes = bytes(base);
        bytes memory uriBytes = bytes(_tokenURI);

        if (baseBytes.length > uriBytes.length) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        for (uint256 i = 0; i < baseBytes.length; ++i) {
            if (uriBytes[i] != baseBytes[i]) {
                return string(abi.encodePacked(base, _tokenURI));
            }
        }

        return _tokenURI;
    }
}
