const MockTransferHelperLibrary = artifacts.require("MockTransferHelperLibrary")
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw")

contract("test TransferHelperLibrary.sol", accounts => {
    let mockTransferHelperLibrary

    beforeEach(async () => {
        mockTransferHelperLibrary = await MockTransferHelperLibrary.new()
    })

    it("good transfer", async () => {
        await verifyBalanceChange(accounts[0], 1024, () =>
            mockTransferHelperLibrary.transferEth(
                accounts[1],
                1024,
                {value: 1024, from: accounts[0], gasPrice: 0}
            )
        )
    })

    it("good transfer with more value", async () => {
        await verifyBalanceChange(accounts[0], 2048, () =>
            verifyBalanceChange(mockTransferHelperLibrary.address, -1024, () =>
                mockTransferHelperLibrary.transferEth(
                    accounts[1],
                    1024,
                    {value: 2048, from: accounts[0], gasPrice: 0}
                )
            )
        )
    })

    it("bad transfer with less value", async () => {
        await expectThrow(
            mockTransferHelperLibrary.transferEth(
                accounts[1],
                1024,
                {value: 1023, from: accounts[0], gasPrice: 0}
            ),
            "bad eth transfer"
        )
    })
})
