#!/bin/bash

truffle test truffle test/test_files/OrderLibrary-test.js \
  test/contracts/MockOrderLibrary.sol \
  --compile-all
