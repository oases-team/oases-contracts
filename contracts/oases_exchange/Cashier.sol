// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma abicoder v2;

import "../interfaces/ICashier.sol";
import "../interfaces/IERC20TransferProxy.sol";
import "../interfaces/INFTTransferProxy.sol";
import "../interfaces/ITransferProxy.sol";
import "../common_libraries/AssetLibrary.sol";
import "./libraries/TransferHelperLibrary.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract Cashier is OwnableUpgradeable, ICashier {
    using TransferHelperLibrary for address;

    mapping(bytes4 => address) transferProxies;

    event SetTransferProxy(bytes4 indexed assetType, address transferProxyAddress);

    function __Cashier_init_unchained(
        IERC20TransferProxy ERC20TransferProxyAddress,
        INFTTransferProxy NFTTransferProxyAddress
    ) internal {
        transferProxies[AssetLibrary.ERC20_ASSET_CLASS] = address(ERC20TransferProxyAddress);
        transferProxies[AssetLibrary.ERC721_ASSET_CLASS] = address(NFTTransferProxyAddress);
        transferProxies[AssetLibrary.ERC1155_ASSET_CLASS] = address(NFTTransferProxyAddress);
    }

    function transfer(
        AssetLibrary.Asset memory asset,
        address from,
        address to,
        bytes4 direction,
        bytes4 transferType
    )
    internal
    override
    {
        if (asset.assetType.assetClass == AssetLibrary.ETH_ASSET_CLASS) {
            to.transferEth(asset.value);
        } else if (asset.assetType.assetClass == AssetLibrary.ERC20_ASSET_CLASS) {
            // decode ERC20 address
            (address addressERC20) = abi.decode(asset.assetType.data, (address));
            IERC20TransferProxy(transferProxies[AssetLibrary.ERC20_ASSET_CLASS]).safeTransferFromERC20(
                IERC20Upgradeable(addressERC20),
                from,
                to,
                asset.value
            );
        } else if (asset.assetType.assetClass == AssetLibrary.ERC721_ASSET_CLASS) {
            // decode ERC721 address and token id
            (address addressERC721, uint256 tokenId) = abi.decode(asset.assetType.data, (address, uint256));
            require(asset.value == 1, "ERC721's strict amount");
            INFTTransferProxy(transferProxies[AssetLibrary.ERC721_ASSET_CLASS]).safeTransferFromERC721(
                IERC721Upgradeable(addressERC721),
                from,
                to,
                tokenId
            );
        } else if (asset.assetType.assetClass == AssetLibrary.ERC1155_ASSET_CLASS) {
            // decode ERC1155 address and id
            (address addressERC1155, uint256 id) = abi.decode(asset.assetType.data, (address, uint256));
            INFTTransferProxy(transferProxies[AssetLibrary.ERC1155_ASSET_CLASS]).safeTransferFromERC1155(
                IERC1155Upgradeable(addressERC1155),
                from,
                to,
                id,
                asset.value,
                ""
            );
        } else {
            // transfer the asset(not ETH/ERC20/ERC721/ERC1155) by customized transfer proxy
            ITransferProxy(transferProxies[asset.assetType.assetClass]).transfer(asset, from, to);
        }

        emit Transfer(asset, from, to, direction, transferType);
    }

    // set transfer proxy address by the owner
    function setTransferProxy(bytes4 assetType, address transferProxyAddress) external onlyOwner {
        transferProxies[assetType] = transferProxyAddress;
        emit SetTransferProxy(assetType, transferProxyAddress);
    }

    uint256[49] private __gap;
}
