#!/usr/bin/env node
import { config } from "dotenv";
import { spawn } from "child_process";

// Load .env
config();

const rpc = process.env.RPC_FOR_FORK;
const block = process.env.FORK_BLOCK || "46267996";

if (!rpc) {
  console.error("❌ ERROR: RPC_FOR_FORK is not set in your .env file");
  process.exit(1);
}

console.log("✅ Starting anvil...");
console.log("   RPC URL   :", rpc);
console.log("   Block     :", block);

//const args = ["--fork-url", rpc, "--fork-block-number", block];

// adding some accounts to unlock
const args = ["--fork-url", rpc, "--fork-block-number", block,"--auto-impersonate"];



// On Windows, set shell: true so anvil.exe is found
const child = spawn("anvil", args, { stdio: "inherit", shell: false });

child.on("error", (err) => {
  console.error("❌ Failed to start anvil:", err);
});

child.on("close", (code) => {
  console.log(`anvil exited with code ${code}`);
});
