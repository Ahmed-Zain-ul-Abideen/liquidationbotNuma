import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();
import fs from 'fs/promises';
import process from 'process';
import { readFileSync } from 'fs';
import nodemailer from "nodemailer";

const config = JSON.parse(readFileSync('./config.json', 'utf8'));
// You can also use a lightweight CLI parser like `minimist` if needed
const args = process.argv.slice(2);


const listOnly = args.includes('-l') || args.includes('--list');

const numaBorrower = args.includes('-n');


// extract chain name (first non-flag argument)
const chainName = process.env.CHAIN || args.find(arg => !arg.startsWith('-'));

if (!chainName) {
  console.error("Usage: node bot.js <chainName> [options]");
  process.exit(1);
}

// keep track of last email per borrower
const lastAlertSent = new Map();
const ALERT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER, // your email
    pass: process.env.SMTP_PASS, // your email password / app password
  },
});

async function sendAlertEmail(borrower, vaultBalance, liquidationAmount) {
    const now = Date.now(); 
    // check last alert timestamp
    if (lastAlertSent.has(borrower)) {
        const elapsed = now - lastAlertSent.get(borrower);
        if (elapsed < ALERT_COOLDOWN_MS) {
            console.log(`⏳ Skipping email for ${borrower}, cooldown still active (${Math.round((ALERT_COOLDOWN_MS - elapsed) / 1000)}s left).`);
            return;
        }
    }

    const formatNum = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });


    const mailOptions = {
        from: `"Vault Monitor" <${process.env.SMTP_USER}>`,
        to: process.env.ALERT_EMAIL || "you@example.com",
        subject: `⚠️ Vault Lacks Liquidity – Borrower ${borrower.slice(0, 6)}...${borrower.slice(-4)}`,
        text: `
            Vault is missing liquidity for liquidation.

            Borrower: ${borrower}
            Vault Balance: ${vaultBalance}
            Required Liquidation Amount: ${liquidationAmount}

            Please review immediately.
        `,
        html: `
            <h2>⚠️ Vault Lacks Liquidity</h2>
            <p><b>Borrower:</b> ${borrower}</p>
            <p><b>Vault Balance:</b> ${formatNum(vaultBalance)}</p>
            <p><b>Required Liquidation Amount:</b> ${formatNum(liquidationAmount)}</p>
            <p>📌 Action Required.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        lastAlertSent.set(borrower, now); // update timestamp
        console.log(`📧 Alert email sent successfully for borrower ${borrower}`);
    } catch (err) {
        console.error("❌ Failed to send alert email:", err);
    }
}




async function  sendLiquidationEmail(borrower, vaultBalance, liquidationAmount,liqtyp) {
    const now = Date.now(); 
    // check last alert timestamp
    if (lastAlertSent.has(borrower)) {
        const elapsed = now - lastAlertSent.get(borrower);
        if (elapsed < ALERT_COOLDOWN_MS) {
            console.log(`⏳ Skipping email for ${borrower}, cooldown still active (${Math.round((ALERT_COOLDOWN_MS - elapsed) / 1000)}s left).`);
            return;
        }
    }

    const formatNum = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });


    const mailOptions = {
        from: `"Vault Monitor" <${process.env.SMTP_USER}>`,
        to: process.env.ALERT_EMAIL || "you@example.com",
        subject: `⚠️ Borrower Liquidated  – Borrower ${borrower.slice(0, 6)}...${borrower.slice(-4)}`,
        text: `
            Liquidation  type  ( ${liqtyp} ).

            Borrower: ${borrower}
            Vault Balance: ${vaultBalance}
            Liquidation Amount: ${liquidationAmount}

            Please review immediately.
        `,
        html: `
            <h2>⚠️ Liquidation  type  ( ${liqtyp} )</h2>
            <p><b>Borrower:</b> ${borrower}</p>
            <p><b>Vault Balance:</b> ${formatNum(vaultBalance)}</p>
            <p><b>Liquidation Amount:</b> ${formatNum(liquidationAmount)}</p>
            <p>📌 Action Required.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        lastAlertSent.set(borrower, now); // update timestamp
        console.log(`📧 Liquidation email  sent successfully for borrower ${borrower}`);
    } catch (err) {
        console.error("❌ Failed to send Liquidation email:", err);
    }
}

const data = config[chainName];
console.log(data);
if (!data) {
  console.error(`Unknown chain: ${chainName}`);
  console.log("Available chains:", Object.keys(config).join(", "));
  process.exit(1);
}




// 📌 Configure wallet & provider
// const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SONIC_SNIPE);
// const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_SNIPE, provider);

const provider = new ethers.JsonRpcProvider(data.RPC_URL);
const wallet = new ethers.Wallet(data.PRIVATE_KEY, provider);




// 📌 contracts SONIC
const comptrollerAddress = data.comptroller; 
let cNumaAddress = data.cNuma;
let cLstAddress = data.cLst;

const vaultAddress = data.vault;
const oracleAddress = data.oracle;
const stsAddress = data.lst;
const collateralFactor = 950000000000000000;

if (numaBorrower)
{
    cNumaAddress = data.cLst;
    cLstAddress = data.cNuma;
}


const comptrollerAbi = [
    "function getAllMarkets() view returns (address[])",
    "function closeFactorMantissa() view returns (uint256)",
    "function getAccountLiquidityIsolate(address,address,address) view returns (uint, uint, uint, uint,uint)"
];

const cTokenAbi = [
    "function borrowBalanceStored(address account) view returns (uint256)",
    "function exchangeRateStored() view returns (uint256)",
    "function liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral) returns (uint256)",
    "event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)",
    "function borrowBalanceStored(address account) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint)",
    "function approve(address spender, uint256 amount) returns (bool)",
];
const vaultAbi = [
    "function numaToLst(uint256 _amount) external view returns (uint256)",
    "function liquidateLstBorrower(address _borrower,uint _lstAmount,bool _swapToInput,bool _flashloan)"
];


const compoundOracleAbi = [
    "function getUnderlyingPriceAsBorrowed(address cToken) public view returns (uint)",
    "function getUnderlyingPriceAsCollateral(address cToken) public view returns (uint)"
];



const comptroller = new ethers.Contract(comptrollerAddress, comptrollerAbi, provider);
let cNuma = new ethers.Contract(cNumaAddress, cTokenAbi, wallet);
let crEth = new ethers.Contract(cLstAddress, cTokenAbi, wallet);


const vault = new ethers.Contract(vaultAddress, vaultAbi, wallet);
const oracle = new ethers.Contract(oracleAddress, compoundOracleAbi, wallet);
const sts = new ethers.Contract(stsAddress, cTokenAbi, wallet);
async function getBorrowersWithLTV(fromBlock = 46267996) 
{
    // 🔍 Fetch Borrow Events
    const borrowFilter = crEth.filters.Borrow();
    const logs = await provider.getLogs({
        address: cLstAddress,
        fromBlock, // Set to a recent block to avoid excessive data
        toBlock: "latest",
        topics: borrowFilter.topics,
    });

    // 📌 Extract Unique Borrower Addresses
    const borrowers = new Set();
    logs.forEach((log) => {
        const parsed = crEth.interface.parseLog(log);
        if (parsed != null)
        {
            //console.log(parsed.args.borrower);
            borrowers.add(parsed.args.borrower);
        }
    });

    console.log(`📌 Found ${borrowers.size} borrowers in LST market`);
    return Array.from(borrowers);
} 

async function getBorrowerData(address) {
  try {
    const [ , liquidity, shortfall,badDebt,Ltv ] = await comptroller.getAccountLiquidityIsolate(address,cNumaAddress,cLstAddress);


    const supplyBal = await cNuma.balanceOf(address);
    const exRate = await cNuma.exchangeRateStored();

    // borrow balance
    const borrowUnderlying = await crEth.borrowBalanceStored(address);
    const borrowPriceInSts = await oracle.getUnderlyingPriceAsBorrowed(crEth);
    const borrowInsTs = borrowPriceInSts * borrowUnderlying / BigInt(1e18);



    const snapshot = await cNuma.getAccountSnapshot(address);
    const collateralPrice = await oracle.getUnderlyingPriceAsCollateral(cNuma);

    const collateralBalance = snapshot[1];
    const exchangeRate = snapshot[3];
 
    const tokensToDenomCollateral = BigInt(collateralFactor)*exchangeRate*collateralPrice;
    const tokensToDenomCollateralNoCollateralFactor = exchangeRate*collateralPrice;

    const collateralInsTs = collateralBalance * tokensToDenomCollateral / BigInt(1e54);
    const collateralInsTsNoCF = collateralBalance * tokensToDenomCollateralNoCollateralFactor / BigInt(1e36);


    let LiquidationType = 0;// 0: no liquidation, 1: std liquidation, 2: partial liquidation threshold, 3: partial liquidation ltv > 110 4: bad debt liquidation
    let LiquidationAmount = borrowInsTs;
    if (shortfall > 0) 
    {
        LiquidationType = 1;// just call liquidate
        if (Number(ethers.formatUnits(Ltv, 16)) > 110) // > 110
        {
            // partial liquidation ltv > 110
            LiquidationType = 3;// find optimal % of borrow amount
            // 25%
            //LiquidationAmount = LiquidationAmount/BigInt(4);

            // try to get as much as collateral as possible
            LiquidationAmount = (collateralInsTsNoCF /BigInt(102))* BigInt(100) - BigInt(1000000000000000000);
            if (LiquidationAmount <= 0)
            {
                LiquidationType = 0;// no liquidation possible because no collateral
            }
        }
        else if (badDebt > 0) // 100 -> 110
        {
            // bad debt liquidation
            LiquidationType = 4;// TODO
        }
    
        else if (borrowInsTs > BigInt(300000000000000000000000))
        {
            LiquidationType = 2; // we can liquidate 300000000000000000000000 or more
            LiquidationAmount = 300000000000000000000000;
        }

    }
    let LiquidityInVault = true;
    let VaultBalance = await sts.balanceOf(vaultAddress);


    if (process.env.MAX_TEST_VAULT_BALANCE) {
        const cap = BigInt(process.env.MAX_TEST_VAULT_BALANCE);
        if (VaultBalance > cap) {
            VaultBalance = cap;
        }
    }


    if (VaultBalance < LiquidationAmount)
    {
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
      liquidationAmount: Number(ethers.formatUnits(LiquidationAmount,18)),
      vaultBalance: Number(ethers.formatUnits(VaultBalance,18)),
      liquidityInVault: LiquidityInVault

    };
  } catch (err) {
      console.error(`Failed to fetch data for ${address}:`, err.message);

      if (err.message.includes("Too Many Requests")) {
          console.warn("Rate limited, retrying...");
          await new Promise(r => setTimeout(r, 3000)); // exponential backoff
          // try again
          return getBorrowerData(address);
      }
      else {
          return null;
      }

    
  }
}



function decimalToBigInt(num, decimals) {
  if (typeof num !== "number" || isNaN(num)) {
    throw new TypeError("Expected a valid number");
  }
  const scale = 10 ** decimals; // e.g. 2 decimals → multiply by 100
  return BigInt(Math.round(num * scale));
}


async function monitorLoop() {

    const borrowers = await getBorrowersWithLTV();
    for (const addr of borrowers) {
        const data = await getBorrowerData(addr);
        if (!data) {
            console.warn(`⚠️ Skipping ${addr}, no data returned.`);
            continue; // prevents crash
        }
        console.log(`📌 data.liquidationType ${data.liquidationType}     ,   data.liquidityInVault    ${data.liquidityInVault},  data.vaultBalance  ${data.vaultBalance},   borrower  address  ${addr} `);
        if (data.liquidationType != 0)
        {
            // liquidation possible
            if (data.liquidityInVault)
            {
                // we don't need to provide liquidity
                if (data.liquidationType == 1)
                {     
                    
                    console.log("💀 Liquidating borrower (std):", addr);
                    let  liqtp = "Standard";
                    console.log(data.liquidationAmount)  ;  
                    try {
                        await vault.liquidateLstBorrower(addr,
                            decimalToBigInt(data.liquidationAmount, 18),
                            true,
                            false// no flashloan for this one to test it
                        )

                        await sendLiquidationEmail(addr, data.vaultBalance, data.liquidationAmount,liqtp);
                    } catch (e) {
                        console.log("Error during liquidation:", e);
                    }
                }
                // else if (data.liquidationType == 2)
                // {
                //     await vault.liquidateLstBorrower(addr,
                //         data.liquidationAmount,
                //         true,
                //         true
                //     )
                // }
                else if (data.liquidationType == 3) {
                    console.log("💀 Liquidating borrower (bad debt):", addr);
                    let  liqtp = "Bad  Debt";
                    console.log(data.liquidationAmount);
                    try {
                        await vault.liquidateLstBorrower(addr,
                            decimalToBigInt(data.liquidationAmount, 18),
                            true,
                            true
                        )

                        await sendLiquidationEmail(addr, data.vaultBalance, data.liquidationAmount,liqtp);
                    } catch (e) {
                        console.log("Error during liquidation:", e);
                    }
                }
                // else if (data.liquidationType == 4)
                // {
                //     // TODO
                //     // BAD DEBT liquidation

                // }
            }
            else
            {
                // TODO: provide liquidity
                // Vault lacks liquidity, trigger alert
                console.log(`⚠️ Vault lacks liquidity. Borrower: ${addr}, VaultBalance: ${data.vaultBalance}, Required: ${data.liquidationAmount}`);
                await sendAlertEmail(addr, data.vaultBalance, data.liquidationAmount);
            }
        }


    } 
    console.log("********************************");

    
}


async function main() {
    console.log("🚀 Liquidation bot started...");


    // if -l, get all borrowers then exit
    if (listOnly) {
        const borrowers = await getBorrowersWithLTV();
        
        const allData = [];

        for (const addr of borrowers) {
            const data = await getBorrowerData(addr);
            if (data) allData.push(data);
        }
        console.log(allData);   
        let filename = `borrowersData_${chainName}.json`; 

        if (numaBorrower)
        {
            filename = `borrowersData_NumaBorrow_${chainName}.json`;
        }


        await fs.writeFile(filename, JSON.stringify(allData, null, 2));
        console.log(`Saved ${allData.length} borrower entries to borrowersData.json`);
        
        
        return; // exit here
    }
    else
    {
        // approve for liquidation using bot's sts
        await sts.approve(vaultAddress, BigInt(2)**BigInt(256)-BigInt(1));


        // 🔁 Run every 30s, without blocking deployment
        setInterval(monitorLoop, 30000); // 30 seconds

         
        

        // Wait before next scan
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s delay
    }
}


export { main };
