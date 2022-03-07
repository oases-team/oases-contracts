// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../oases_exchange/libraries/TransferHelperLibrary.sol";
import "./ERC721OasesBase.sol";

// todo: just a framework
contract ERC721Oases is ERC721OasesBase {
    using TransferHelperLibrary for address;

    // records of price for each token id on chain
    mapping(uint256 => uint256) prices;

    /// @dev true if collection is private, false if public
    bool isPrivate;

    event CreateERC721Oases(address owner, string name, string symbol);
    event CreateERC721OasesUser(address owner, string name, string symbol);

    event PriceChanged(uint256 tokenId, uint256 newPrice);
    event Trade(
        uint256 tokenId,
        uint256 price,
        address newOwner,
        address originalOwner
    );

    function __ERC721OasesUser_init(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        string memory contractURI,
        address[] memory operators,
        address transferProxy,
        address lazyTransferProxy
    ) 
    external 
    initializer 
    {
        __ERC721Oases_init_unchained(
            _name,
            _symbol,
            baseURI,
            contractURI,
            transferProxy,
            lazyTransferProxy
        );

        for (uint256 i = 0; i < operators.length; i++) {
            setApprovalForAll(operators[i], true);
        }

        isPrivate = true;
        emit CreateERC721OasesUser(_msgSender(), _name, _symbol);
    }

    function __ERC721Oases_init(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        string memory contractURI,
        address transferProxy,
        address lazyTransferProxy
    ) 
    external 
    initializer 
    {
        __ERC721Oases_init_unchained(
            _name,
            _symbol,
            baseURI,
            contractURI,
            transferProxy,
            lazyTransferProxy
        );

        isPrivate = false;
        emit CreateERC721Oases(_msgSender(), _name, _symbol);
    }

    function __ERC721Oases_init_unchained(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        string memory contractURI,
        address transferProxy,
        address lazyTransferProxy
    ) 
    internal 
    {
        _setBaseURI(baseURI);
        __ERC721Lazy_init_unchained();
        // TODO: update __RoyaltiesV2Upgradeable_init_unchained
        __RoyaltiesV2Upgradeable_init_unchained();
        __ERC165_init_unchained();
        __Ownable_init_unchained();
        __ERC721Burnable_init_unchained();
        __Mint721Validator_init_unchained();
        __ContractURIUpgradeable_init_unchained(contractURI);
        __ERC721_init_unchained(_name, _symbol);

        //setting default approver for transferProxies
        _setDefaultApproval(transferProxy, true);
        _setDefaultApproval(lazyTransferProxy, true);
    }

    function mintAndTransfer(
        ERC721LazyMintLibrary.ERC721LazyMintData memory erc721LazyMintData,
        address to
    ) 
    public 
    virtual 
    override 
    {
        if (isPrivate) {
            require(
                owner() == erc721LazyMintData.creatorInfos[0].account,
                "minter is not the owner"
            );
        }
        super.mintAndTransfer(erc721LazyMintData, to);
    }

    // set price by the token's owner
    // NOTE: it means not for sale when the price is set to ZERO
    function setPrice(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "no qualification");
        prices[tokenId] = price;
        emit PriceChanged(tokenId, price);
    }

    // buy token from the original owner with eth
    function trade(uint256 tokenId, bytes memory data) external payable {
        // will check the existence of token
        address originalOwner = ownerOf(tokenId);
        address newOwner = msg.sender;
        require(newOwner != originalOwner, "self trading");
        uint256 price = prices[tokenId];
        require(price != 0, "not for sale");
        require(msg.value == price, "wrong payment");
        // clear price
        prices[tokenId] = 0;
        // transfer payment
        originalOwner.transferEth(price);
        // transfer token
        _safeTransfer(originalOwner, newOwner, tokenId, data);
        emit Trade(tokenId, price, newOwner, originalOwner);
    }

    // get the price on chain
    function getPrice(uint256 tokenId) public view returns (uint256) {
        require(_exists(tokenId), "token not exists");
        return prices[tokenId];
    }

    uint256[50] private __gap;
}
