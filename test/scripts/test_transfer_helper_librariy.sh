#!/bin/bash

truffle test truffle test/test_files/TransferHelperLibrary-test.js \
  test/contracts/MockTransferHelperLibrary.sol \
  --compile-all
