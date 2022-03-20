const Impl = artifacts.require("MockRoyaltiesImpl.sol");
const Test = artifacts.require("MockRoyalties.sol");

contract("Oases RoyaltyInfo", accounts => {
	let impl;
	let testing;

	beforeEach(async () => {
		impl = await Impl.new();
		testing = await Test.new(impl.address);
	})

	it("simple impl works", async () => {
		await impl.saveRoyaltyInfos(10, [{ account: accounts[1], value: 100 }]);

		const result = await impl.getOasesRoyaltyInfos(10);
		assert.equal(result.length, 1);
		assert.equal(result[0][0], accounts[1]);
		assert.equal(result[0][1], 100);

		const tx = await testing.royaltiesTest(10);
		console.log("used gas", tx.receipt.gasUsed);
	})

	it("update allows to change royalty recipient", async () => {
		await impl.saveRoyaltyInfos(10, [{ account: accounts[1], value: 100 }]);
		await impl.updateAccount(10, accounts[1], accounts[2]);

		const result = await impl.getOasesRoyaltyInfos(10);
		assert.equal(result.length, 1);
		assert.equal(result[0][0], accounts[2]);
		assert.equal(result[0][1], 100);

	})

})