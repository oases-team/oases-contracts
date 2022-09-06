const BN = web3.utils.BN
const decimals = new BN("1000000000000000000")

function bn(value) {
    return new BN(value)
}

function assertEq(v1, v2) {
    assert(new BN(v1).eq(new BN(v2)), "v1=" + v1.toString() + " v2=" + v2.toString());
}

module.exports.assertEq = assertEq

module.exports.verifyBalanceChange = async function (account, change, todo) {
    let before = new BN(await web3.eth.getBalance(account))
    await todo()
    let after = new BN(await web3.eth.getBalance(account))
    let actual = before.sub(after)
    assertEq(change, actual)
}

module.exports.expectThrow = async function (promise, message) {
    try {
        await promise
    } catch (error) {
        const invalidOpcode = error.message.search('invalid opcode') >= 0
        const outOfGas = error.message.search('out of gas') >= 0
        const revert = error.message.search('while processing transaction: revert') >= 0
        const overflow = (error['reason'] = 'overflow')

        assert(
            invalidOpcode || outOfGas || revert || overflow,
            "Expected throw, got '" + error + "' instead",
        )

        assert(
            message ? error.message.includes(message) : true,
            `expect revert message "${message}", but "${error.message}" in fact`
        )

        return
    }
    assert(false, message ? message : 'Expected throw not received')
}