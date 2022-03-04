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