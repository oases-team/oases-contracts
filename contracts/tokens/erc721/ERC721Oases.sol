// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "../../oases_exchange/libraries/TransferHelperLibrary.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";

// todo: just a framework
contract ERC721Oases is ERC721EnumerableUpgradeable {
    using TransferHelperLibrary for address;

    // records of price for each token id on chain
    mapping(uint256 => uint256) prices;

    event PriceChanged(uint256 tokenId, uint256 newPrice);
    event Trade(uint256 tokenId, uint256 price, address newOwner, address originalOwner);

    // todo:simple init
    function __ERC721Oases_init(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        string memory contractURI,
        address transferProxy,
        address lazyTransferProxy
    ) external initializer {
        // todo
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
        require(msg.value >= price, "wrong payment");
        // clear price
        prices[tokenId] = 0;
        // transfer payment
        originalOwner.transferEth(price);
        // transfer token
        _safeTransfer(originalOwner, newOwner, tokenId, data);
        emit Trade(tokenId, price, newOwner, originalOwner);
    }

    // get the price on chain
    function getPrice(uint256 tokenId) public view returns (uint256){
        require(_exists(tokenId), "token not exists");
        return prices[tokenId];
    }
}
