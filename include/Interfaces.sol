// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;


// Interfaces
interface IERC20 {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IComptroller {
    function admin() external view returns (address);
    function enterMarkets(
        address[] calldata cTokens
    ) external virtual returns (uint[] memory);

    function _setMintPaused(address cToken, bool state) external virtual returns (bool);
    function _setBorrowPaused(address cToken, bool state) external virtual returns (bool);
    function getAccountLiquidityIsolate(
        address account,
        ICNumaToken cTokenModify,
        ICNumaToken cTokenIgnore
    ) external view returns (uint, uint, uint, uint, uint);
}

interface ICNumaToken {
    function borrow(uint borrowAmount) external virtual returns (uint);
    function mint(uint mintAmount) external virtual returns (uint);
    function borrowBalanceStored(address account) external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
}

interface IVault {

    function unpause() external;
    function owner() external view returns (address);
    function withdrawToken(address token, uint amount, address to) external;
    function updateWhitelist(address user, bool allowed) external;
}