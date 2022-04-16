#!/bin/bash

truffle test truffle test/test_files/ERC721PackageTransferProxy-test.js \
  test/contracts/mock_tokens/MockERC721.sol \
  --compile-all
