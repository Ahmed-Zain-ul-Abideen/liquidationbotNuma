// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {Test, console} from "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {Config} from "../include/Config.sol";
import {IERC20, ICNumaToken, IComptroller} from "../include/Interfaces.sol";



contract LiquidationTest is Test {
    using stdJson for string;

    address user = makeAddr(Config.user);
    address user2 = makeAddr(Config.user2);

    ICNumaToken cLst;
    ICNumaToken cNuma;
    IERC20 numa;
    IERC20 lst;
    IComptroller comptroller;

    uint vaultBalance;
    uint botBalance;
    uint borrow;
        


    function setUp() public 
    {
        cLst = ICNumaToken(Config.cLst_address);
        cNuma = ICNumaToken(Config.cNuma_address);
        numa = IERC20(Config.numa_address);
        lst = IERC20(Config.lst_address);
        comptroller = IComptroller(Config.comptroller_address);

        string memory path = "./snapshot.json";
        string memory json = vm.readFile(path); // <-- read the file as string

        vaultBalance = json.readUint(".vaultBalance");
        botBalance   = json.readUint(".botBalance");
        borrow       = json.readUint(".borrowUser2");
        
     
    }

    function test_StandardLiquidation() public {
        // check account state
        // - account should have borrow balance at zero
        uint borrowBalance = cLst.borrowBalanceStored(user);
        assertEq(borrowBalance, 0);

        // check bot profit
        uint botProfit = lst.balanceOf(Config.bot_address) - botBalance;
        console.log("LST profit of bot ", botProfit);

        // if bot has done his job it should profit around 267.99 sTs
        assertGt(botProfit, 250 ether);
       
    }

    function test_BadDebtLiquidation() public {
        // check account state
        // account should still be in bad debt
        (, uint liquidity, uint shortfall,uint badDebt,) = comptroller.getAccountLiquidityIsolate(
            user2,
            cNuma,
            cLst
        );

        assertEq(liquidity, 0);
        assertGt(shortfall, 0);   
        assertGt(badDebt, 0);   

        // all collateral should be seized
        // uint collateralBalance = cNuma.balanceOf(user2);
        // assertEq(collateralBalance, 0);

        uint borrowBalance = cLst.borrowBalanceStored(user2);
        assertGt(borrowBalance, 0);

        assertLt(borrowBalance, borrow);// borrow balance should be less than before
        // if user2 is liquidated as much as possible his borrow remaining should be around 10405.28 sTs
        assertLt(borrowBalance, 13000 ether);
       
    }


}
