const ERC721Oases = artifacts.require("ERC721Oases.sol");
const ERC1271 = artifacts.require("MockERC1271.sol");
// const UpgradeableBeacon = artifacts.require("UpgradeableBeacon.sol");
const ERC721LazyMintTransferProxy = artifacts.require("ERC721LazyMintTransferProxyTest.sol");
const MockTransferProxy = artifacts.require("MockTransferProxy.sol");
const truffleAssert = require('truffle-assertions');

const { sign } = require("./utils/mint");
const {expectThrow, verifyBalanceChange} = require("./utils/expect_throw");

contract("ERC721Oases", accounts => {

  let token;
  let tokenOwner = accounts[9];
  let erc1271;
//   let beacon;
  let proxy;
  let proxyLazy;
  let whiteListProxy = accounts[5];
  const name = 'FreeMintableOases';
  const chainId = 1;
  const zeroWord = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const ZERO = "0x0000000000000000000000000000000000000000";

  function creators(list) {
  	const value = 10000 / list.length
  	return list.map(account => ({ account, value }))
  }

  beforeEach(async () => {
    token = await ERC721Oases.new();
    proxyLazy = await ERC721LazyMintTransferProxy.new();
    transferProxy = await MockTransferProxy.new();
    await token.__ERC721Oases_init(name, "OAS", "https://ipfs.oases.com", "https://ipfs.oases.com", whiteListProxy, proxyLazy.address);
    // console.log(`owner: ${await token.owner()}`)
    await token.transferOwnership(tokenOwner);
    erc1271 = await ERC1271.new();
  });

  describe("Burn before ERC721Oases()", () => {
    it("Run burn from minter, mintAndTransfer by the same minter not possible, token burned, throw", async () => {
      const minter = accounts[1];
      let transferTo = accounts[4];

      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";
      //minter burn item, in tokenId minter address contains, ok
      await token.burn(tokenId, {from: minter});
      await expectThrow( //try to mint and transfer token, throw, because token was burned
        token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, {from: minter}),
        "token already burned"
      );
    });

    it("Run burn from another, throw, mintAndTransfer by the same minter is possible", async () => {
      const minter = accounts[1];
      let transferTo = accounts[2];

      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";
      await expectThrow( //another burn item, in tokenId minter address contains, throw
        token.burn(tokenId, {from: transferTo}),
        "ERC721Burnable: caller is not owner, not burn"
      );
      //mint and transfer token, ok, because token was not burned, possible to mint to a new user
      await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, {from: minter});
      assert.equal(await token.ownerOf(tokenId), transferTo);
    });
  });

  describe("Burn after ERC721Oases ()", () => {
    it("Run mintAndTransfer, burn, mintAndTransfer by the same minter, throw", async () => {
      const minter = accounts[1];
      let transferTo = accounts[2];
      let transferTo2 = accounts[4];

      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";

      await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, {from: minter});
      await token.burn(tokenId, {from: transferTo});
      await expectThrow( //try once more mint and transfer
        token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo2, {from: minter}),
        'token already burned'
      );
    });

    it("Run transferFromOrMint, burn, transferFromOrMint by the same minter, throw", async () => {
      const minter = accounts[1];
      let transferTo = accounts[2];

      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";

      await token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: minter});
      assert.equal(await token.ownerOf(tokenId), transferTo);
      await token.burn(tokenId, {from: transferTo});
      await expectThrow(
        token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: minter}),
        'token already burned'
      )
    });
  });

  it("mint and transfer by minter", async () => {
    tokenByProxy = token

    const minter = tokenOwner;
    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    const tx = await tokenByProxy.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, {from: minter});
    const Transfer = await tokenByProxy.getPastEvents("Transfer", {
      fromBlock: tx.receipt.blockNumber,
      toBlock: tx.receipt.blockNumber
    });
    assert.equal(Transfer.length, 1, "Transfer.length")

    assert.equal(await tokenByProxy.ownerOf(tokenId), minter);
  });

  it("checkPrefix should work correctly, checks for duplicating of the base part of the uri ", async () => {
    // beacon = await UpgradeableBeacon.new(token.address);
    // factory = await ERC721Factory.new(beacon.address, transferProxy.address, proxyLazy.address);
    const baseURI = "https://ipfs.oases.com"
    // const resultCreateToken = await factory.methods['createToken(string,string,string,string,uint256)']("name", "RARI", baseURI, "https://ipfs.rarible.com", 1, {from: tokenOwner});
    // truffleAssert.eventEmitted(resultCreateToken, 'Create721RaribleProxy', (ev) => {
    //    proxy = ev.proxy;
    //   return true;
    // });
    // tokenByProxy = await ERC721Oases.at(proxy);
    tokenByProxy = token

    const baseURI1 = await token.baseURI()

    const minter = tokenOwner;
    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = baseURI + "/12345/456";

    await tokenByProxy.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, {from: minter});
    const gettokeURI = await tokenByProxy.tokenURI(tokenId);
    assert.equal(gettokeURI, tokenURI, "token uri same with base")

    const tokenId1 = minter + "b00000000000000000000002"
    const tokenURI1 = "/12345/123512512/12312312";
    await tokenByProxy.mintAndTransfer([tokenId1, tokenURI1, creators([minter]), [], [zeroWord]], minter, {from: minter});
    const gettokeURI1 = await tokenByProxy.tokenURI(tokenId1);
    assert.equal(gettokeURI1, baseURI + tokenURI1, "different uri")

    const tokenId2 = minter + "b00000000000000000000003"
    const tokenURI2 = "/12345/";
    await tokenByProxy.mintAndTransfer([tokenId2, tokenURI2, creators([minter]), [], [zeroWord]], minter, {from: minter});
    const gettokeURI2 = await tokenByProxy.tokenURI(tokenId2);
    assert.equal(gettokeURI2, baseURI + tokenURI2, "different uri")
  });

  it("check for ERC165 interface", async () => {
  	assert.equal(await token.supportsInterface("0x01ffc9a7"), true);
  });

  it("check for mintAndTransfer interface", async () => {
  	assert.equal(await token.supportsInterface("0x8486f69f"), true);
  });

  it("check for RoayltiesV2 interface", async () => {
  	assert.equal(await token.supportsInterface("0xc963b961"), true);
  });

  it("check for ERC721 interfaces", async () => {
  	assert.equal(await token.supportsInterface("0x80ac58cd"), true);
  	assert.equal(await token.supportsInterface("0x5b5e139f"), true);
  	assert.equal(await token.supportsInterface("0x780e9d63"), true);
  });

  it("approve for all", async () => {
    assert.equal(await token.isApprovedForAll(accounts[1], whiteListProxy), true);
    assert.equal(await token.isApprovedForAll(accounts[1], proxyLazy.address), true);
  });

  it("mint and transfer by whitelist proxy", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    let fees = [];

    const signature = await getSignature(tokenId, tokenURI, creators([minter]), fees, minter);

    const tx = await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), fees, [signature]], transferTo, {from: whiteListProxy});
    const Transfer = await token.getPastEvents("Transfer", {
      fromBlock: tx.receipt.blockNumber,
      toBlock: tx.receipt.blockNumber
    });
    assert.equal(Transfer.length, 2, "Transfer.length")
    const transferEvent0 = Transfer[0]
    const transferEvent1 = Transfer[1]

    assert.equal(transferEvent0.args.from, "0x0000000000000000000000000000000000000000", "transfer 0 from")
    assert.equal(transferEvent0.args.to, minter, "transfer 0 to")
    assert.equal("0x" + transferEvent0.args.tokenId.toString(16), tokenId.toLowerCase(), "transfer 0 tokenId")

    assert.equal(transferEvent1.args.from, minter, "transfer 1 from")
    assert.equal(transferEvent1.args.to, transferTo, "transfer 1 to")
    assert.equal("0x" + transferEvent1.args.tokenId.toString(16), tokenId.toLowerCase(), "transfer 1 tokenId")

    assert.equal(await token.ownerOf(tokenId), transferTo);
    await checkCreators(tokenId, [minter]);
  });

  it("mint and transfer by whitelist proxy. several creators", async () => {
    const minter = accounts[1];
    const creator2 = accounts[3];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    let fees = [];

    const signature1 = await getSignature(tokenId, tokenURI, creators([minter, creator2]), fees, minter);
    const signature2 = await getSignature(tokenId, tokenURI, creators([minter, creator2]), fees, creator2);

    await token.mintAndTransfer([tokenId, tokenURI, creators([minter, creator2]), fees, [signature1, signature2]], transferTo, {from: whiteListProxy});

    assert.equal(await token.ownerOf(tokenId), transferTo);
    await checkCreators(tokenId, [minter, creator2]);
  });

  it("mint and transfer by whitelist proxy. several creators. minter is not first", async () => {
    const minter = accounts[1];
    const creator2 = accounts[3];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    let fees = [];

    const signature1 = await getSignature(tokenId, tokenURI, creators([creator2, minter]), fees, minter);
    const signature2 = await getSignature(tokenId, tokenURI, creators([creator2, minter]), fees, creator2);

    await expectThrow(
      token.mintAndTransfer([tokenId, tokenURI, creators([creator2, minter]), fees, [signature2, signature1]], transferTo, {from: whiteListProxy})
    );
  });

  it("mint and transfer by whitelist proxy. several creators. wrong order of signatures", async () => {
    const minter = accounts[1];
    const creator2 = accounts[3];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    let fees = [];

    const signature1 = await getSignature(tokenId, tokenURI, creators([minter, creator2]), fees, minter);
    const signature2 = await getSignature(tokenId, tokenURI, creators([minter, creator2]), fees, creator2);

    await expectThrow(
      token.mintAndTransfer([tokenId, tokenURI, creators([minter, creator2]), fees, [signature2, signature1]], transferTo, {from: whiteListProxy})
    );
  });

  it("mint and transfer by approved proxy for all", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    const signature = await getSignature(tokenId, tokenURI, creators([minter]), [], minter);

    let proxy = accounts[5];
    await token.setApprovalForAll(proxy, true, {from: minter});
    const ttxx = await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [signature]], transferTo, {from: proxy});
    console.log(ttxx.receipt.gasUsed)

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("mint and transfer by approved proxy for tokenId", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    const signature = await getSignature(tokenId, tokenURI, creators([minter]), [], minter);

    let proxy = accounts[5];

    await expectThrow(
      token.approve(proxy, tokenId, {from: minter})
    );
  });

  it("mint and transfer by minter", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, {from: minter});

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("transferFromOrMint from minter. not yet minted", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    await token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: minter});

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("transferFromOrMint from minter. already minted", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

		await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, {from: minter});
    await token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: minter});
    await expectThrow(
    	token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: minter})
    )

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("transferFromOrMint when not minter. not yet minted", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

		await expectThrow(
			token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: transferTo})
		);
    await token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, transferTo, {from: minter});
    await token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, accounts[5], {from: transferTo});

    assert.equal(await token.ownerOf(tokenId), accounts[5]);
  });

  it("mint not by minter, throw", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];
    let transferTo2 = accounts[4];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    await expectThrow( //try once more mint and transfer
      token.transferFromOrMint([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, transferTo2, {from: minter}),
      'from not minter'
    );
  });

  it("mint and transfer to self by minter", async () => {
    const minter = accounts[1];
    let transferTo = minter;

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], transferTo, {from: minter});

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("mint and transfer with signature of not minter", async () => {
    const minter = accounts[1];
    const transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    const signature = await getSignature(tokenId, tokenURI, creators([minter]), [], transferTo);

    await expectThrow(
      token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [signature]], transferTo, {from: whiteListProxy})
    );
  });

  it("mint and transfer without approval", async () => {
    const minter = accounts[1];
    let transferTo = accounts[2];

    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";

    const signature = await getSignature(tokenId, tokenURI, creators([minter]), [], minter);

    await expectThrow(
      token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [signature]], transferTo, {from: accounts[3]})
    );
  });

  it("standard transfer from owner", async () => {
    let minter = accounts[1];
    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, {from: minter});

    assert.equal(await token.ownerOf(tokenId), minter);

    let transferTo = accounts[2];
    await token.transferFrom(minter, transferTo, tokenId, {from: minter});

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("standard transfer by approved contract", async () => {
    let minter = accounts[1];
    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, {from: minter});

    assert.equal(await token.ownerOf(tokenId), minter);

    let transferTo = accounts[2];
    await token.transferFrom(minter, transferTo, tokenId, {from: whiteListProxy});

    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  it("standard transfer by not approved contract", async () => {
    let minter = accounts[1];
    const tokenId = minter + "b00000000000000000000001";
    const tokenURI = "//uri";
    await token.mintAndTransfer([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, {from: minter});

    assert.equal(await token.ownerOf(tokenId), minter);

    let transferTo = accounts[2];
    await expectThrow(
      token.transferFrom(minter, transferTo, tokenId, {from: accounts[8]})
    );
  });

  it("signature by contract wallet erc1271, with whitelist proxy", async () => {
    const minter = erc1271;
    let transferTo = accounts[2];

    const tokenId = minter.address + "b00000000000000000000001";
    const tokenURI = "//uri";

    await expectThrow(
      token.mintAndTransfer([tokenId, tokenURI, creators([minter.address]), [], [zeroWord]], transferTo, {from: whiteListProxy})
    );

    await erc1271.setReturnSuccessfulValidSignature(true);
    await token.mintAndTransfer([tokenId, tokenURI, creators([minter.address]), [], [zeroWord]], transferTo, {from: whiteListProxy});
    assert.equal(await token.ownerOf(tokenId), transferTo);
  });

  describe("trade onchain", () => {
    it("mintWithPrice, setPrice", async () => {
      const minter = accounts[1];
      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";
      let result = await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, 1000, {from: minter});
      assert.equal(await token.ownerOf(tokenId), minter);
      truffleAssert.eventEmitted(result, 'PriceChanged', (ev) => {
        const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
        return id == tokenId.toLowerCase() && +ev.newPrice == 1000;
      });
      result = await token.setPrice(tokenId, 0, { from: minter });
      truffleAssert.eventEmitted(result, 'PriceChanged', (ev) => {
        const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
        return id == tokenId.toLowerCase() && +ev.newPrice == 0;
      });
    });
    it("mintWithPrice, price is zero", async () => {
      const minter = accounts[1];
      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";
      await expectThrow(
        token.mintWithPrice([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, 0, {from: minter}),
        "price is zero"
      );
    });
    it("mintWithPrice, setPrice call by not owner or approved", async () => {
      const minter = accounts[1];
      const caller = accounts[2]
      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";
      await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, 1000, {from: minter});
      await expectThrow(
        token.setPrice(tokenId, 10, { from: caller }),
        "no qualification"
      );
    });
    it("mintWithPrice, set price to 0 when transfer", async() => {
      const minter = accounts[1];
      const transferTo = accounts[2]
      const tokenId = minter + "b00000000000000000000001";
      const tokenURI = "//uri";
      let result = await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, 1000, {from: minter});
      assert.equal(await token.ownerOf(tokenId), minter);
      truffleAssert.eventEmitted(result, 'PriceChanged', (ev) => {
        const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
        return id == tokenId.toLowerCase() && +ev.newPrice == 1000;
      });
      let tx = await token.transferFrom(minter, transferTo, tokenId, { from: minter });
      assert.equal(await token.ownerOf(tokenId), transferTo);
      truffleAssert.eventEmitted(tx, 'PriceChanged', (ev) => {
        const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
        return id == tokenId.toLowerCase() && +ev.newPrice == 0;
      });
      assert.equal(await token.getPrice(tokenId), 0)
    });

    it("trade with more eth and refund", async() => {
        const minter = accounts[1];
        const buyer = accounts[2]
        const tokenId = minter + "b00000000000000000000001";
        const tokenURI = "//uri";
        const price = 1000;
        let result = await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, price, {from: minter});
        assert.equal(await token.ownerOf(tokenId), minter);
        truffleAssert.eventEmitted(result, 'PriceChanged', (ev) => {
            const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
            return id == tokenId.toLowerCase() && +ev.newPrice == 1000;
        });

        // trade with more price
        await verifyBalanceChange(minter, -price, async () =>
            verifyBalanceChange(buyer, price, async () =>
                token.trade(tokenId, [], {from: buyer, value: price + 100, gasPrice: '0x'})
            )
        );

        assert.equal(await token.ownerOf(tokenId), buyer);
        assert.equal(await token.getPrice(tokenId), 0);

        token.setPrice(tokenId, price, {from: buyer});
        // revert if less payment
        await expectThrow(
            token.trade(tokenId, [], {from: minter, value: price - 1}),
            'bad eth transfer'
        );
    });

      it("trade with emitting event", async () => {
          const minter = accounts[1];
          const buyer = accounts[2]
          const tokenId = minter + "b00000000000000000000001";
          const tokenURI = "//uri";
          const price = 1000;
          let tx = await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [], [zeroWord]], minter, price, {from: minter});
          assert.equal(await token.ownerOf(tokenId), minter);
          truffleAssert.eventEmitted(tx, 'PriceChanged', (ev) => {
              const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
              return id == tokenId.toLowerCase() && ev.newPrice == 1000;
          });

          // trade
          tx = await token.trade(tokenId, [], {from: buyer, value: price})
          truffleAssert.eventEmitted(tx, 'PriceChanged', (ev) => {
              const id = ("0x" + BigInt(ev.tokenId).toString(16)).toLowerCase()
              return id == tokenId.toLowerCase() && ev.newPrice == 0;
          });
          assert.equal(await token.ownerOf(tokenId), buyer);
          assert.equal(await token.getPrice(tokenId), 0);
      });

      it("trade with royalty equal to 50%", async () => {
          const minter = accounts[1];
          const buyer = accounts[2]
          const tokenId = minter + "b00000000000000000000001";
          const tokenURI = "//uri";
          const price = 1000;
          // with 50% royalty
          await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [[accounts[3], 2000], [accounts[4], 3000]], [zeroWord]], minter, price, {from: minter});
          assert.equal(await token.ownerOf(tokenId), minter);


          // trade with 50% royalty
          await verifyBalanceChange(minter, -price * (1 - 0.2 - 0.3), async () =>
              verifyBalanceChange(buyer, price, async () =>
                  verifyBalanceChange(accounts[3], -price * 0.2, async () =>
                      verifyBalanceChange(accounts[4], -price * 0.3, async () =>
                          token.trade(tokenId, [], {from: buyer, value: price + 100, gasPrice: '0x'})
                      )
                  )
              )
          );

          assert.equal(await token.ownerOf(tokenId), buyer);
          assert.equal(await token.getPrice(tokenId), 0);
      });

      it("revert if trade with royalty over 50%", async () => {
          const minter = accounts[1];
          const buyer = accounts[2]
          const tokenId = minter + "b00000000000000000000001";
          const tokenURI = "//uri";
          const price = 1000;

          // with 51% royalty
          await token.mintWithPrice([tokenId, tokenURI, creators([minter]), [[accounts[3], 2000], [accounts[4], 3100]], [zeroWord]], minter, price, {from: minter});
          assert.equal(await token.ownerOf(tokenId), minter);

          // trade with 51% royalty
          await expectThrow(
              token.trade(tokenId, [], {from: buyer, value: price}),
              'royalties sum exceeds 50%'
          );
      });
  });

  function getSignature(tokenId, tokenURI, creators, fees, account) {
		return sign(account, tokenId, tokenURI, creators, fees, token.address);
  }

  async function checkCreators(tokenId, exp) {
    const creators = await token.getCreatorInfos(tokenId);
    assert.equal(creators.length, exp.length);
    const value = 10000 / exp.length;
    for(let i = 0; i < creators.length; i++) {
      assert.equal(creators[i][0], exp[i]);
      assert.equal(creators[i][1], value);
    }
  }
});