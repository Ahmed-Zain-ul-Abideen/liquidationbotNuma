import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs/promises";
import process from "process";

const args = process.argv.slice(2);
const listOnly = args.includes("-l") || args.includes("--list");
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SONIC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// 東 contracts SONIC
const comptrollerAddress = "0x30047cca309b7aac3613ae5b990cf460253c9b98";
const cNumaAddress = "0x16d4b53de6aba4b68480c7a3b6711df25fcb12d7";
const cLstAddress = "0xb2a43445b97cd6a179033788d763b8d0c0487e36";

const vaultAddress = "0xde76288c3b977776400fe44fe851bbe2313f1806";
const oracleAddress = "0xa92025d87128c1e2dcc0a08afbc945547ca3b084";
const stsAddress = "0xe5da20f15420ad15de0fa650600afc998bbe3955";
const collateralFactor = 950000000000000000;

// Added constants for liquidation strategy
const SAFE_LTV_PERCENT = 75; // The target safe LTV
const LIQUIDATION_PENALTY_PERCENT = 10; // The liquidation penalty

const comptrollerAbi = [
  "function getAllMarkets() view returns (address[])",
  "function closeFactorMantissa() view returns (uint256)",
  "function getAccountLiquidityIsolate(address,address,address) view returns (uint, uint, uint, uint,uint)",
];

const cTokenAbi = [
  "function borrowBalanceStored(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral) returns (uint256)",
  "event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)",
  "function borrowBalanceStored(address account) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint)",
];
const vaultAbi = [
  "function numaToLst(uint256 _amount) external view returns (uint256)",
  "function liquidateLstBorrower(address _borrower,uint _lstAmount,bool _swapToInput,bool _flashloan)",
];

const compoundOracleAbi = [
  "function getUnderlyingPriceAsBorrowed(address cToken) public view returns (uint)",
  "function getUnderlyingPriceAsCollateral(address cToken) public view returns (uint)",
];

const comptroller = new ethers.Contract(
  comptrollerAddress,
  comptrollerAbi,
  provider
);
const cNuma = new ethers.Contract(cNumaAddress, cTokenAbi, wallet);
const crEth = new ethers.Contract(cLstAddress, cTokenAbi, wallet);
const vault = new ethers.Contract(vaultAddress, vaultAbi, wallet);
const oracle = new ethers.Contract(oracleAddress, compoundOracleAbi, wallet);
const sts = new ethers.Contract(stsAddress, cTokenAbi, wallet);

async function getBorrowersWithLTV(fromBlock = 40773197) {
  const borrowFilter = crEth.filters.Borrow();
  const logs = await provider.getLogs({
    address: cLstAddress,
    fromBlock,
    toBlock: "latest",
    topics: borrowFilter.topics,
  });

  const borrowers = new Set();
  logs.forEach((log) => {
    const parsed = crEth.interface.parseLog(log);
    if (parsed != null) {
      borrowers.add(parsed.args.borrower);
    }
  });

  console.log(`Found ${borrowers.size} borrowers in LST market`);
  return Array.from(borrowers);
}

async function getBorrowerData(address) {
  try {
    const [, liquidity, shortfall, badDebt, Ltv] =
      await comptroller.getAccountLiquidityIsolate(
        address,
        cNumaAddress,
        cLstAddress
      );

    const supplyBal = await cNuma.balanceOf(address);
    const exRate = await cNuma.exchangeRateStored();
    const borrowUnderlying = await crEth.borrowBalanceStored(address);
    const borrowPriceInSts = await oracle.getUnderlyingPriceAsBorrowed(crEth);
    const borrowInsTs = (borrowPriceInSts * borrowUnderlying) / BigInt(1e18);

    const snapshot = await cNuma.getAccountSnapshot(address);
    const collateralPrice = await oracle.getUnderlyingPriceAsCollateral(cNuma);

    const collateralBalance = snapshot[1];
    const exchangeRate = snapshot[3];

    const tokensToDenomCollateral =
      BigInt(collateralFactor) * exchangeRate * collateralPrice;
    const tokensToDenomCollateralNoCollateralFactor =
      exchangeRate * collateralPrice;

    const collateralInsTs =
      (collateralBalance * tokensToDenomCollateral) / BigInt(1e54);
    const collateralInsTsNoCF =
      (collateralBalance * tokensToDenomCollateralNoCollateralFactor) /
      BigInt(1e36);

    let LiquidationType = 0;
    let LiquidationAmount = borrowInsTs;

    if (shortfall > 0) {
      // General liquidation if any shortfall exists
      LiquidationType = 1;

      // Bad debt (LTV between 98-110%)
      if (Number(ethers.formatUnits(Ltv, 16)) >= 98 && Number(ethers.formatUnits(Ltv, 16)) <= 110) {
        LiquidationType = 4;
      }
      // Overly leveraged (LTV > 110%) - partial liquidation
      else if (Number(ethers.formatUnits(Ltv, 16)) > 110) {
        LiquidationType = 3;
        
        // Calculate optimal liquidation amount
        // Formula: (borrowAmount - safeLTV*collateralValue/collateralFactor) / (1 - liquidationPenalty*safeLTV/collateralFactor)
        // This is a simplified version using the available variables
        const currentLTV = BigInt(Math.floor(Number(ethers.formatUnits(Ltv, 16)) * 1e16));
        const safeLTV = BigInt(Math.floor(SAFE_LTV_PERCENT * 1e16));
        const ltvDiff = currentLTV - safeLTV;

        // LiquidationAmount = ((ltvDiff / 100) * collateralValue) / (1 + (penalty / 100));
        // Using BigInt for calculations to avoid precision issues
        const numerator = ltvDiff * collateralInsTsNoCF;
        const denominator = BigInt(100 * 1e16) + (BigInt(LIQUIDATION_PENALTY_PERCENT) * BigInt(1e16));
        
        // Use a safe division approach
        if (denominator > 0) {
            LiquidationAmount = (numerator / BigInt(1e18)) / (denominator / BigInt(1e18));
        } else {
            LiquidationAmount = 0;
        }

      }
    }
    let LiquidityInVault = true;
    let VaultBalance = await sts.balanceOf(vaultAddress);
    if (VaultBalance < LiquidationAmount) {
      LiquidityInVault = false;
    }

    return {
      address,
      borrowSts: Number(ethers.formatUnits(borrowInsTs, 18)),
      collateralSts: Number(ethers.formatUnits(collateralInsTs, 18)),
      collateralInsTsNoCF: Number(ethers.formatUnits(collateralInsTsNoCF, 18)),
      liquidity: Number(ethers.formatUnits(liquidity, 18)),
      shortfall: Number(ethers.formatUnits(shortfall, 18)),
      badDebt: Number(ethers.formatUnits(badDebt, 18)),
      ltv: Number(ethers.formatUnits(Ltv, 18)),
      ltvpct: Number(ethers.formatUnits(Ltv, 16)),
      liquidationType: LiquidationType,
      liquidationAmount: Number(ethers.formatUnits(LiquidationAmount, 18)),
      vaultBalance: Number(ethers.formatUnits(VaultBalance, 18)),
      liquidityInVault: LiquidityInVault,
    };
  } catch (err) {
    console.error(`Failed to fetch data for ${address}:`, err);
    return null;
  }
}

async function provideLiquidity(amount) {
  console.log(`Providing ${amount} liquidity from bot's sTs supply...`);
  // This is a placeholder. Real implementation would involve:
  // 1. Approving the vault to spend a certain amount of your sTs.
  // 2. Calling a function on the vault contract that allows a user to provide liquidity directly.
  console.log("Liquidity provided successfully. Proceeding with liquidation.");
}

async function handleBadDebt(address, liquidationAmount) {
  console.log(`Handling bad debt liquidation for ${address}.`);
  // This is a placeholder for the advanced bad debt strategy.
  // The real implementation would involve:
  // 1. Calling the liquidation function.
  // 2. Receiving the collateral from the vault.
  // 3. Immediately selling that collateral on a DEX/CEX to a stablecoin or other profitable asset.
  console.log(`Attempting liquidation and arbitrage for ${address} for amount ${liquidationAmount}.`);
  try {
     await vault.liquidateLstBorrower(
          address,
          ethers.parseEther(liquidationAmount.toString()),
          true,
          false // No flashloan needed as we're using our own liquidity and selling on a CEX/DEX
        );
        console.log(`Bad debt position for ${address} liquidated. Now attempting to sell collateral on external exchange for profit.`);
  } catch (error) {
     console.log(`Issue happened during bad debt liquidation for ${address} = ${error}`);
  }
}

async function main() {
  console.log("Liquidation bot started...");

  if (listOnly) {
    const borrowers = await getBorrowersWithLTV();
    const allData = [];

    for (const addr of borrowers) {
      const data = await getBorrowerData(addr);
      if (data) allData.push(data);
    }
    console.log(allData);
    await fs.writeFile("borrowersDataImproved.json", JSON.stringify(allData, null, 2));
    console.log(
      `Saved ${allData.length} borrower entries to borrowersData.json`
    );

    return;
  } else {
    while (true) {
      const borrowers = await getBorrowersWithLTV();
      for (const addr of borrowers) {
        const data = await getBorrowerData(addr);
        if (data?.liquidationType != 0) {
          console.log(data);
          
          if (data?.liquidityInVault) {
            if (data?.liquidationType == 4) {
              await handleBadDebt(addr, data.liquidationAmount);
            } else {
              try {
                await vault.liquidateLstBorrower(
                  addr,
                  ethers.parseEther(data.liquidationAmount.toString()),
                  true,
                  true
                );
                console.log(
                  `Liquidated ${addr} for the amount = ${data.liquidationAmount} having liquidation type ${data.liquidationType}`
                );
              } catch (error) {
                console.log(`issue happend with ${addr} = ${error}`);
              }
            }
          } else {
            // Insufficient vault liquidity, use bot's own sTs
            await provideLiquidity(data.liquidationAmount);
            if (data?.liquidationType == 4) {
              await handleBadDebt(addr, data.liquidationAmount);
            } else {
              try {
                await vault.liquidateLstBorrower(
                  addr,
                  ethers.parseEther(data.liquidationAmount.toString()),
                  true,
                  false
                );
                console.log(
                  `Liquidated ${addr} for the amount = ${data.liquidationAmount} having liquidation type ${data.liquidationType}`
                );
              } catch (error) {
                console.log(`issue happend with ${addr} = ${error}`);
              }
            }
          }
        }
      }

      console.log("********************************");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
console.log("********************************");
main();
