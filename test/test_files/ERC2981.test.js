const Impl = artifacts.require("MockRoyalties2981Impl.sol");
const Test = artifacts.require("MockRoyalties2981.sol");

contract("royalties 2981 ", accounts => {
  let impl;
  let testing;

  beforeEach(async () => {
    impl = await Impl.new();
    testing = await Test.new(impl.address);
  })

  it("simple impl works", async () => {
    const amount = 100;
    const getRoyalties = accounts[1];
    const tokenId = getRoyalties + "b00000000000000000000001";

    await impl.setRoyalties(1000)
    const result = await impl.royaltyInfo(tokenId, amount);
    assert.equal(result[0], getRoyalties);
    assert.equal(result[1], 10);

    const tx = await testing.royaltyInfoTest(tokenId, amount);
    console.log("used gas", tx.receipt.gasUsed);
  })

  it("calculateRoyalties check", async () => {
    const getterRoyalties = accounts[1];
    const result = await impl.calculateRoyaltiesTest.call(getterRoyalties, 150000);
    assert.equal(result.length, 1);
    assert.equal(result[0][0], getterRoyalties);
    assert.equal(result[0][1], 1500);
  })

  it("Get different % 2981 royalties by token", async () => {
    const getRoyalties = accounts[1];
    const tokenId = getRoyalties + "b00000000000000000000001";

    // royalties 4.2%
    await impl.setRoyalties(420);
    let result = await impl.royaltyInfo(tokenId, 1000);
    assert.equal(result[0], getRoyalties);
    assert.equal(result[1], 42);

    // royalties 0.01%
    await impl.setRoyalties(1);
    result = await impl.royaltyInfo(tokenId, 10000);
    assert.equal(result[0], getRoyalties);
    assert.equal(result[1], 1);

    //royalties 50%
    await impl.setRoyalties(5000);
    result = await impl.royaltyInfo(tokenId, 10000);
    assert.equal(result[0], getRoyalties);
    assert.equal(result[1], 5000);
  })
})