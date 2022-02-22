const MockSignatureLibrary = artifacts.require("MockSignatureLibrary.sol");
const ethUtil = require('ethereumjs-util');
const {signMessage} = require('./utils/signature.js');

contract('test SignatureLibrary.sol', accounts => {
    let mockSignatureLibrary;
    const msg = 'message for test';
    before(async () => {
        mockSignatureLibrary = await MockSignatureLibrary.new();
    });

    it("should return the right signer when v > 30", async () => {
        const hash = `0x${ethUtil.keccakFromString(msg).toString('hex')}`
        const signature = await signMessage(hash, accounts[0]);
        const newSignature = signature.r + signature.s.substring(2) + (signature.v + 4).toString(16);
        const signer = await mockSignatureLibrary.recover(hash, newSignature);
        assert.equal(signer, accounts[0], "signer address");
    });
});