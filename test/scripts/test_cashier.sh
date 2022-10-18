#!/bin/bash

truffle test ./test/test_files/Cashier-test.js \
  ./test/contracts/MockCashier.sol \
  ./test/contracts/MockERC20TransferProxy.sol \
  ./test/contracts/MockNFTTransferProxy.sol \
  ./test/contracts/MockOldERC721TransferProxy.sol \
  ./test/contracts/CustomTransferProxy.sol \
  ./test/contracts/mock_tokens/MockBadERC721.sol \
  ./test/contracts/mock_tokens/MockERC721.sol \
  ./test/contracts/mock_tokens/MockERC20.sol \
  ./test/contracts/mock_tokens/MockERC1155.sol \
  ./test/contracts/mock_tokens/CustomERC20.sol \
  --compile-all
