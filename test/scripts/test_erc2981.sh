#!/usr/bin/env bash
truffle test ./test/test_files/ERC2981.test.js \
              ./test/contracts/MockRoyalties2981.sol \
              ./test/contracts/MockRoyalties2981Impl.sol \
              --compile-all