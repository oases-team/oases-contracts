const {deployProxy} = require('@openzeppelin/truffle-upgrades')
const truffleAssert = require('truffle-assertions')
const ProtocolFeeProvider = artifacts.require("ProtocolFeeProvider.sol")
const MockERC721 = artifacts.require("MockERC721.sol")

const {expectThrow} = require("./utils/expect_throw")

contract('test ProtocolFeeProvider.sol', accounts => {
    let testing;
    let mockERC721_1;
    let mockERC721_2;
    const owner = accounts[0];

    const protocolFeeBasisPoint = 250;
    beforeEach(async () => {
        mockERC721_1 = await MockERC721.new();
        mockERC721_2 = await MockERC721.new();
        testing = await deployProxy(
            ProtocolFeeProvider,
            [
                protocolFeeBasisPoint
            ],
            {
                initializer: '__ProtocolFeeProvider_init_unchained'
            }
        );
    });

    it("pass setDefaultProtocolBasisPoint", async () => {
        assert.equal(await testing.getDefaultProtocolFeeBasisPoint(), protocolFeeBasisPoint);
        // revert if not owner
        await expectThrow(
            testing.setDefaultProtocolBasisPoint(500, {from: accounts[1]}),
            "Ownable: caller is not the owner"
        );

        truffleAssert.eventEmitted(
            await testing.setDefaultProtocolBasisPoint(500),
            'DefaultProtocolBasisPointChanged',
            (ev) => {
                assert.equal(ev.newDefaultProtocolBasisPoint, 500);
                assert.equal(ev.preDefaultProtocolBasisPoint, 250);
                return true
            }, "DefaultProtocolBasisPointChanged should be emitted with correct parameters")

        assert.equal(await testing.getDefaultProtocolFeeBasisPoint(), 500);
    })

    it("pass setCustomizedProtocolFeeBasisPoint by owner", async () => {
        assert.equal(await testing.getDefaultProtocolFeeBasisPoint(), protocolFeeBasisPoint);
        // add
        truffleAssert.eventEmitted(
            await testing.setCustomizedProtocolFeeBasisPoint(mockERC721_1.address, true, 500),
            'UpdateCustomizedProtocolFeeBasisPoint',
            (ev) => {
                assert.equal(ev.nftAddress, mockERC721_1.address);
                assert.equal(ev.isAdded, true);
                assert.equal(ev.customizedProtocolFeeBasisPoint, 500);
                return true
            }, "UpdateCustomizedProtocolFeeBasisPoint should be emitted with correct parameters")

        assert.equal(await testing.getCustomizedProtocolFeeBasisPoint(mockERC721_1.address), 500);

        await expectThrow(
            testing.setCustomizedProtocolFeeBasisPoint(mockERC721_1.address, true, 500, {from: accounts[1]}),
            'Ownable: caller is not the owner'
        )

        // add nft address already registered
        truffleAssert.eventEmitted(
            await testing.setCustomizedProtocolFeeBasisPoint(mockERC721_1.address, true, 1500),
            'UpdateCustomizedProtocolFeeBasisPoint',
            (ev) => {
                assert.equal(ev.nftAddress, mockERC721_1.address);
                assert.equal(ev.isAdded, true);
                assert.equal(ev.customizedProtocolFeeBasisPoint, 1500);
                return true
            }, "UpdateCustomizedProtocolFeeBasisPoint should be emitted with correct parameters")

        assert.equal(await testing.getCustomizedProtocolFeeBasisPoint(mockERC721_1.address), 1500);

        // remove
        truffleAssert.eventEmitted(
            await testing.setCustomizedProtocolFeeBasisPoint(mockERC721_1.address, false, 500),
            'UpdateCustomizedProtocolFeeBasisPoint',
            (ev) => {
                assert.equal(ev.nftAddress, mockERC721_1.address);
                assert.equal(ev.isAdded, false);
                assert.equal(ev.customizedProtocolFeeBasisPoint, 0);
                return true
            }, "UpdateCustomizedProtocolFeeBasisPoint should be emitted with correct parameters")

        await expectThrow(
            testing.getCustomizedProtocolFeeBasisPoint(mockERC721_1.address),
            "not customized"
        )

        // remove an nft address not registered
        await expectThrow(
            testing.getCustomizedProtocolFeeBasisPoint(mockERC721_2.address),
            "not customized"
        )

        truffleAssert.eventEmitted(
            await testing.setCustomizedProtocolFeeBasisPoint(mockERC721_2.address, false, 111500),
            'UpdateCustomizedProtocolFeeBasisPoint',
            (ev) => {
                assert.equal(ev.nftAddress, mockERC721_2.address);
                assert.equal(ev.isAdded, false);
                assert.equal(ev.customizedProtocolFeeBasisPoint, 0);
                return true
            }, "UpdateCustomizedProtocolFeeBasisPoint should be emitted with correct parameters")

        await expectThrow(
            testing.getCustomizedProtocolFeeBasisPoint(mockERC721_2.address),
            "not customized"
        )
    });

    it("check getProtocolFeeBasisPoint", async () => {
        await mockERC721_1.mint(accounts[1], 1024, {from: accounts[1]});
        await mockERC721_2.mint(accounts[1], 1024, {from: accounts[1]});
        // set customized protocolFeeBasisPoint to 1
        await testing.setCustomizedProtocolFeeBasisPoint(mockERC721_1.address, true, 1);

        // get protocol fee bp for registered nft for the owner of that
        assert.equal(await testing.getProtocolFeeBasisPoint(
            mockERC721_1.address,
            accounts[1]),
            1
        );

        // get protocol fee bp for registered nft for the one not the owner of that
        assert.equal(await testing.getProtocolFeeBasisPoint(
            mockERC721_1.address,
            accounts[0]
            ),
            protocolFeeBasisPoint
        );

        // get protocol fee bp for not registered nft for the owner of that
        assert.equal(await testing.getProtocolFeeBasisPoint(
            mockERC721_2.address,
            accounts[1]
            ),
            protocolFeeBasisPoint
        );

        // get protocol fee bp for not registered nft for the one not the owner of that
        assert.equal(await testing.getProtocolFeeBasisPoint(
            mockERC721_2.address,
            accounts[0]
            ),
            protocolFeeBasisPoint
        );
    })
});