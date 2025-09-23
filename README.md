# Liquidation Bot Local Testing

This project provides a local setup for testing a numa liquidation bot using a forked Sonic network with Foundry + Anvil.


## Setup

1. Create a `.env` file in the root directory with your fork RPC URL and this block number:
   ```env
   RPC_FOR_FORK=https://your_sonic_rpc_url
   FORK_BLOCK=46267996 
   ```


2. Install dependencies:
   ```bash
   npm install
   ```

3. Install [Foundry](https://book.getfoundry.sh/getting-started/installation)


## Workflow

The workflow is split into **four steps**, each mapped to an npm script:

### 1. Start local fork
```bash
npm run fork
```
- Launches a local fork of sonic mainnet on block 46267996 (via `anvil` inside `scripts/fork.js`).
- Runs on localhost

### 2. Setup accounts & protocol state
```bash
npm run setup
```
Uses Foundry `SetupAccount.s.sol` script to:

- creates a user with collateral and a borrow position.
- make user liquiditable
  


### 3. Run the liquidation bot
```bash
npm run bot
```
- Executes your JS liquidation bot (`liquidationBot.js`).  
- Targets the local fork and attempts to perform liquidations.

### 4. Check results
```bash
npm run check
```
- Runs Foundry tests against the fork.  
- Verifies liquidations executed correctly.  


## Example Full Run

```bash
# Terminal 1: run fork
npm run fork

# Terminal 2: setup accounts
npm run setup

# Terminal 2: run bot
npm run bot

# Terminal 2: check results
npm run check
```

---

## Workflow Diagram

```text
 ┌───────────────┐       ┌──────────────┐       ┌───────────────┐       ┌───────────────┐
 │               │       │              │       │               │       │               │
 │ Fork (anvil)    ─────▶   Setup        ─────▶  Run Bot         ────▶   Check Tests 
 │               │       │              │       │               │       │               │
 └───────────────┘       └──────────────┘       └───────────────┘       └───────────────┘
       npm run fork         npm run setup          npm run bot            npm run check
```

---

## Notes

- `--unlocked` allows using specific accounts on the local fork.  
- Make sure the fork is running before `setup`, `bot`, or `check`.  
- You can edit `script/SetupAccount.s.sol` to change how accounts are prepared.  
