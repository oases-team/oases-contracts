const {deployProxy} = require('@openzeppelin/truffle-upgrades')
const truffleAssert = require('truffle-assertions')
const ProtocolFeeProvider = artifacts.require("ProtocolFeeProvider.sol")
const MockERC721 = artifacts.require("MockERC721.sol")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const {expectThrow} = require("./utils/expect_throw")

contract('test ProtocolFeeProvider.sol', accounts => {
    let testing;
    let mockERC721MemberCard;

    const protocolFeeBasisPoint = 250;
    beforeEach(async () => {
        mockERC721MemberCard = await MockERC721.new();
        testing = await deployProxy(
            ProtocolFeeProvider,
            [
                protocolFeeBasisPoint
            ],
            {
                initializer: '__ProtocolFeeProvider_init'
            }
        );
    });

    it("getProtocolFeeBasisPoint return default value if member card NFT isn't deployed at once", async () => {
        assert.equal(await testing.getProtocolFeeBasisPoint(accounts[0]), protocolFeeBasisPoint);
    })

    it("pass setMemberCardProtocolFeeBasisPoints()", async () => {
        assert.equal(await testing.getMemberCardProtocolFeeBasisPoints(), 0);
        // revert if not owner
        await expectThrow(
            testing.setMemberCardProtocolFeeBasisPoints(500, {from: accounts[1]}),
            "Ownable: caller is not the owner"
        );

        truffleAssert.eventEmitted(
            await testing.setMemberCardProtocolFeeBasisPoints(500),
            'MemberCardProtocolFeeBasisPointsChanged',
            (ev) => {
                assert.equal(ev.newMemberCardProtocolFeeBasisPoints, 500);
                assert.equal(ev.preMemberCardProtocolFeeBasisPoints, 0);
                return true;
            }, "MemberCardProtocolFeeBasisPointsChanged should be emitted with correct parameters")

        assert.equal(await testing.getMemberCardProtocolFeeBasisPoints(), 500);
    })

    it("pass setMemberCardNFTAddress()", async () => {
        assert.equal(await testing.getMemberCardNFTAddress(), ZERO_ADDRESS);
        const newMemberCardNFT = await MockERC721.new();
        // revert if not owner
        await expectThrow(
            testing.setMemberCardNFTAddress(newMemberCardNFT.address, {from: accounts[1]}),
            "Ownable: caller is not the owner"
        );

        truffleAssert.eventEmitted(
            await testing.setMemberCardNFTAddress(newMemberCardNFT.address),
            'MemberCardNFTAddressChanged',
            (ev) => {
                assert.equal(ev.newMemberCardNFTAddress, newMemberCardNFT.address);
                assert.equal(ev.preMemberCardNFTAddress, ZERO_ADDRESS);
                return true;
            }, "MemberCardNFTAddressChanged should be emitted with correct parameters")

        assert.equal(await testing.getMemberCardNFTAddress(), newMemberCardNFT.address);
    })

    it("pass getDefaultProtocolFeeBasisPoint()", async () => {
        assert.equal(await testing.getDefaultProtocolFeeBasisPoint(), protocolFeeBasisPoint);
        // revert if not owner
        await expectThrow(
            testing.setDefaultProtocolFeeBasisPoint(500, {from: accounts[1]}),
            "Ownable: caller is not the owner"
        );

        truffleAssert.eventEmitted(
            await testing.setDefaultProtocolFeeBasisPoint(500),
            'DefaultProtocolFeeBasisPointChanged',
            (ev) => {
                assert.equal(ev.newDefaultProtocolFeeBasisPoint, 500);
                assert.equal(ev.preDefaultProtocolFeeBasisPoint, protocolFeeBasisPoint);
                return true;
            }, "DefaultProtocolFeeBasisPointChanged should be emitted with correct parameters")

        assert.equal(await testing.getDefaultProtocolFeeBasisPoint(), 500);
    })

    it("check getProtocolFeeBasisPoint", async () => {
        await mockERC721MemberCard.mint(accounts[1], 1024, {from: accounts[1]});

        await testing.setMemberCardNFTAddress(mockERC721MemberCard.address);
        // get protocol fee bp for member card owner
        assert.equal(await testing.getProtocolFeeBasisPoint(accounts[1]), 0);

        // get protocol fee bp for nonmember
        assert.equal(await testing.getProtocolFeeBasisPoint(accounts[0]), protocolFeeBasisPoint);
    })
});