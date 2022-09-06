#!/usr/bin/env bash

truffle test ./test/test_files/ERC721Oases.test.js \
                ./contracts/tokens/erc-721/ERC721Oases.sol \
                ./test/contracts/MockERC721LazyMintLibrary.sol \
                ./test/contracts/mock_tokens/MockERC1271.sol \
                ./test/contracts/ERC721LazyMintTransferProxyTest.sol \
                ./test/contracts/OperatorRoleTest.sol \
                ./test/contracts/MockTransferProxy.sol \
                --compile-all
