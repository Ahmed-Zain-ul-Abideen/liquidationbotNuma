 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


library Config {

    string constant user = "toto";
    string constant user2 = "toto2";
    string constant user3 = "toto3";
    
    uint constant initialNumaAmount = 10000 ether;
    uint constant initialNumaAmount2 = 10000 ether;
    uint constant collateralAmount = 1000 ether;
    uint constant borrowAmount = 5000 ether;
    //
    uint constant collateralAmount2 = 10000 ether;
    uint constant borrowAmount2 = 60000 ether;


    address constant numa_address = 0x83a6d8D9aa761e7e08EBE0BA5399970f9e8F61D9;
    address constant lst_address = 0xE5DA20F15420aD15DE0fa650600aFc998bbE3955; 

    address constant cNuma_address = 0x16d4b53DE6abA4B68480C7A3B6711DF25fcb12D7;
    address constant cLst_address = 0xb2a43445B97cd6A179033788D763B8d0c0487E36; 
    address constant comptroller_address = 0x30047CCA309b7aaC3613ae5B990Cf460253c9b98;
    address constant vault_address = 0xEd84043CBA395bd3eacEc6B378e49cd66E94941d; 
    address constant numa_whale = 0xab82b2eA6Bb96d56B5996d9219d2bfd9D6943520; 
    address constant bot_address = 0x6389f7083468A6005ABFAf8126b688E9AEde3BA9;
}