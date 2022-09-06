#!/usr/bin/env bash
truffle test ./test/test_files/ProtocolFeeProvider-test.js \
  test/contracts/mock_tokens/MockERC721.sol \
  --compile-all