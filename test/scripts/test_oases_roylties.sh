#!/usr/bin/env bash
truffle test ./test/test_files/OasesRoyaltyInfo.test.js \
              ./test/contracts/MockRoyalties.sol \
              ./test/contracts/MockRoyaltiesImpl.sol \
              --compile-all