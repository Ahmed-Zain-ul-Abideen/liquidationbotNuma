// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {Config} from "../include/Config.sol";
import {IERC20, IComptroller, ICNumaToken, IVault} from "../include/Interfaces.sol";



contract ChangeNumaPrice is Script {

    
    

    ICNumaToken public cNuma;
    ICNumaToken public cLst;
    IERC20 public numa; 
    IERC20 public lst;
    IComptroller public comptroller;
    IVault public vault; // NUMA Vault

    address user2 = makeAddr(Config.user2);
    //forge script script/SetupAccount.s.sol:SetupAccount --fork-url fork
    function run() external {
       
        console.log("changing price ",Config.user);
        //
        cNuma = ICNumaToken(Config.cNuma_address);
        cLst = ICNumaToken(Config.cLst_address);
        numa = IERC20(Config.numa_address);
        lst = IERC20(Config.lst_address);
        comptroller = IComptroller(Config.comptroller_address);
        vault = IVault(Config.vault_address);

        vm.startBroadcast(vault.owner()); 

        uint vaultBalance = lst.balanceOf(Config.vault_address);
        uint withdrawAmount = (vaultBalance*2)/5;
        console.log("vault lst balance ",vaultBalance);
        console.log("withdraw ",withdrawAmount);
        console.log("expected balance",vaultBalance - withdrawAmount);
        // withdraw some lst from vault
        vault.withdrawToken(Config.lst_address ,withdrawAmount,vault.owner());

        // add test bot as allowed to liquidate
        vault.updateWhitelist(Config.bot_address,true);

        vm.stopBroadcast();
        // TODO display account snapshot


        // for test
        string memory path = "./snapshot.json";

        // Write JSON
        // vault balance 
        vaultBalance = lst.balanceOf(Config.vault_address);
        // bot balance
        uint botBalance = lst.balanceOf(Config.bot_address);
        // user2 borrow balance
        uint borrow = cLst.borrowBalanceStored(user2);





        // Build JSON manually
        string memory json = string.concat(
            '{',
                '"vaultBalance": "', vm.toString(vaultBalance), '",',
                '"botBalance": "', vm.toString(botBalance), '",',
                '"borrowUser2": "', vm.toString(borrow), '"',
            '}'
        );

        // Write JSON
        vm.writeJson(json, path);
    }
    
}
