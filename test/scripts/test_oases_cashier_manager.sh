#!/bin/bash

truffle test truffle test/test_files/OasesCashierManager-test.js \
  test/contracts/MockOasesCashierManager.sol \
  test/contracts//mock_tokens/MockERC20.sol \
  test/contracts//mock_tokens/MockERC721.sol \
  test/contracts//mock_tokens/MockERC1155.sol \
  ./test/contracts/MockERC20TransferProxy.sol \
  ./test/contracts/MockNFTTransferProxy.sol \
  ./test/contracts/MockRoyaltiesRegistry.sol \
  --compile-all
