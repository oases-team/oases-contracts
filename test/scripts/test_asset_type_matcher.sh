#!/bin/bash

truffle test ./test/test_files/AssetTypeMatcher-test.js \
  ./test/contracts/MockAssetTypeMatcher.sol \
  ./test/contracts/CustomAssetTypeMatcher.sol
