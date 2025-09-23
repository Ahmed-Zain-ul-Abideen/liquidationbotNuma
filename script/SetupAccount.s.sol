// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {Config} from "../include/Config.sol";
import {IERC20, IComptroller, ICNumaToken, IVault} from "../include/Interfaces.sol";



contract SetupAccount is Script {

    address user = makeAddr(Config.user);
    
    ICNumaToken public cNuma;
    ICNumaToken public cLst;
    IERC20 public numa; 
    IERC20 public lst;
    IComptroller public comptroller;
    IVault public vault; // NUMA Vault

    //forge script script/SetupAccount.s.sol:SetupAccount --fork-url fork
    function run() external {
       
        console.log("setting up account ",Config.user);
        //
        cNuma = ICNumaToken(Config.cNuma_address);
        cLst = ICNumaToken(Config.cLst_address);
        numa = IERC20(Config.numa_address);
        lst = IERC20(Config.lst_address);
        comptroller = IComptroller(Config.comptroller_address);
        vault = IVault(Config.vault_address);

        // give user some NUMA and chain token
        vm.startBroadcast(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);// anvil account
        payable(user).transfer(10 ether);      
        // transfer to bot too
        payable(Config.bot_address).transfer(10 ether);
        vm.stopBroadcast();

        // transfer some NUMA to user from whale
        vm.startBroadcast(Config.numa_whale); 
        numa.transfer(user,Config.initialNumaAmount);          
        vm.stopBroadcast();

        // transfer some stS to the bot to test liquidation with amount
        vm.startBroadcast(0xdcF937FeB1761dF3CA3f1Ce861C14d5E0ACB148e); // some stS whale
        lst.transfer(Config.bot_address,5100 ether);          
        vm.stopBroadcast();

   
        // unpause lending
        vm.startBroadcast(comptroller.admin()); 
        comptroller._setMintPaused(Config.cNuma_address,false);
        comptroller._setBorrowPaused(Config.cLst_address,false);
          
        // unpause vault just in case
        vault.unpause();
        console.log("valut unpaused");
        vm.stopBroadcast();

        // USER1
        // deposit and borrow
        vm.startBroadcast(user);

        // // enter market
        address[] memory t = new address[](2);
        t[0] = address(cNuma);
        t[1] = address(cLst);
        comptroller.enterMarkets(t);
        // approve numa for cnuma
        numa.approve(address(cNuma),Config.collateralAmount);
              
        // deposit collateral
        cNuma.mint(Config.collateralAmount);
        console.log("deposited ",Config.collateralAmount/1e18," NUMA as collateral");
        
        // borrow
        cLst.borrow(Config.borrowAmount);
        console.log("borrowed ",Config.borrowAmount/1e18," RETH");
        vm.stopBroadcast();


        // // make it liquiditable
        vm.startBroadcast(vault.owner()); 

        // uint vaultBalance = lst.balanceOf(Config.vault_address);
        // uint withdrawAmount = vaultBalance/3;
        // console.log("vault lst balance ",vaultBalance);
        // console.log("withdraw ",withdrawAmount);
        // console.log("expected balance",vaultBalance - withdrawAmount);
        // // withdraw some lst from vault
        // vault.withdrawToken(Config.lst_address ,withdrawAmount,vault.owner());

        // // add test bot as allowed to liquidate
        vault.updateWhitelist(Config.bot_address,true);
        console.log("bot whitelisted",Config.bot_address);
        vm.stopBroadcast();
        // TODO display account snapshot

    }
}
