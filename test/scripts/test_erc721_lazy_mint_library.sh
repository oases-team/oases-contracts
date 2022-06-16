#!/bin/bash

truffle test ./test/test_files/ERC721LazyMintLibrary.test.js \
              ./test/contracts/MockERC721LazyMintLibrary.sol \
              --compile-all
