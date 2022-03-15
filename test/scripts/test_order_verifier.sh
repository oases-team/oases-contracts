#!/bin/bash

truffle test truffle test/test_files/OrderVerifier-test.js \
  test/contracts/MockOrderVerifier.sol \
  test/contracts/mock_tokens/MockERC1271.sol \
  --compile-all
