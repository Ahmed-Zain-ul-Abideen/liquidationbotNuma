// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {Config} from "../include/Config.sol";
import {IERC20, IComptroller, ICNumaToken, IVault} from "../include/Interfaces.sol";



contract SetupAccount2 is Script {

    
    address user2 = makeAddr(Config.user2);

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

        payable(user2).transfer(10 ether);
        vm.stopBroadcast();

        // transfer some NUMA to user from whale
        vm.startBroadcast(Config.numa_whale); 
        numa.transfer(user2,Config.initialNumaAmount2);          
        
        vm.stopBroadcast();


        address[] memory t = new address[](2);
        // USER2
        // deposit and borrow
        vm.startBroadcast(user2);

        // enter market
        t[0] = address(cNuma);
        t[1] = address(cLst);
        comptroller.enterMarkets(t);
        // approve numa for cnuma
        numa.approve(address(cNuma),Config.collateralAmount2);
              
        // deposit collateral
        cNuma.mint(Config.collateralAmount2);
        console.log("deposited ",Config.collateralAmount2/1e18," NUMA as collateral");
        
        // borrow
        cLst.borrow(Config.borrowAmount2);
        console.log("borrowed ",Config.borrowAmount2/1e18," RETH");
        vm.stopBroadcast();




    }
}
