const MockSignatureLibrary = artifacts.require("MockSignatureLibrary.sol");
const ethUtil = require('ethereumjs-util');
const {signMessage, generateRandomAccount} = require('./utils/signature.js');

contract('test SignatureLibrary.sol', accounts => {
    let mockSignatureLibrary;
    const hash = `0x${ethUtil.keccakFromString('message for test').toString('hex')}`
    before(async () => {
        mockSignatureLibrary = await MockSignatureLibrary.new();
    });

    it("should return the right signer when v > 30", async () => {
        const signature = await signMessage(hash, accounts[0]);
        const newSignature = signature.r + signature.s.substring(2) + (signature.v + 4).toString(16);
        const signer = await mockSignatureLibrary.recoverWithSignature(hash, newSignature);
        assert.equal(signer, accounts[0], "signer address");
    });

    it("should return the right signer when v < 30", async () => {
        const randomAccount = generateRandomAccount();
        const signature = ethUtil.ecsign(ethUtil.toBuffer(hash), randomAccount.privateKey);
        const newSignature = `0x${signature.r.toString('hex')}${signature.s.toString('hex')}${signature.v.toString(16)}`;
        const signer = await mockSignatureLibrary.recoverWithSignature(hash, newSignature);
        const signerCheckSumAddress = web3.utils.toChecksumAddress(randomAccount.address);
        assert.equal(signer, signerCheckSumAddress, "signer address");
    });

    it("should return the right signer when v > 30 with split signature params", async () => {
        const signature = await signMessage(hash, accounts[0]);
        const signer = await mockSignatureLibrary.recoverWithSplitSignatureParams(hash, signature.v + 4, signature.r, signature.s);
        assert.equal(signer, accounts[0], "signer address");
    });

    it("should return the right signer when v < 30 with split signature params", async () => {
        const randomAccount = generateRandomAccount();
        const signature = ethUtil.ecsign(ethUtil.toBuffer(hash), randomAccount.privateKey);
        const signer = await mockSignatureLibrary.recoverWithSplitSignatureParams(hash, signature.v, signature.r, signature.s);
        const signerCheckSumAddress = web3.utils.toChecksumAddress(randomAccount.address);
        assert.equal(signer, signerCheckSumAddress, "signer address");
    });
});