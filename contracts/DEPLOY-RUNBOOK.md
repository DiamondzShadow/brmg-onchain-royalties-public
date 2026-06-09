# Phase 2 deploy + wiring runbook

> **DEPLOYED + WIRED + KEEPER LIVE — 2026-06-09.** Steps 1–5 done.
> - RoyaltyEscrow (Story 1514): **`0x85d9d5c771fe63a27f8cf426b9f894fc028e8bee`** (block 18444081)
> - RoyaltyAdvanceWrapper (Polygon 137, Polygonscan-verified): **`0xffd7096Ee8403D240a3DBE01Df57477cA9393571`** (block 88207615)
> - Keeper EOA: **`0x1D941A735cD187dC8d60e266D8C9858AF15d3F56`** — holds MESSENGER_ROLE on both
> - Registered: DiggerRegistry digger #1 @ **1500 bps (15% LTV)**, `oracle=address(0)` → global NFTValuer; `NFTValuer.setVaultMode(wrapper,wrapper,0)` (modeOf=1). `isListable`/`isCollateral` = true.
> - Keeper: schedule `royalty-advance-watch-15m` RUNNING in **OBSERVE mode** (`ROYALTY_ADVANCE_EXECUTE=0`); config in `~/.royalty-advance.env`.
> - Admin = deploying EOA (Story signer / deployer) — Safe rotation deferred (hygiene step below).
> - **Remaining = Step 6** (first real advance): fund keeper (POL+IP), set a conservative value, lock RT, flip EXECUTE=1.
>
> Note vs draft: Polygon registry is `registerCollection(diggerId,nft,oracle,maxLtvBps)` (NOT `registerInHouseCollection`); valuer is `setVaultMode` (NOT `setMirrorMode`); registration must precede `setVaultMode` (else `NotRegisteredInDiggerRegistry`).

---


Exact sequence to take the royalty-advance contracts live. Dry-runs already pass
(Polygon wrapper 2.26M gas / Story escrow 906k gas). Nothing here is reversible —
work top to bottom, verify each step before the next.

Known principals:
- **Deployer** `0xC5D133296E17BA25DF0409a6C31607bf3B78e3e3` (key `DEPLOYER_PK` in `~/.env`; ~5.6 POL on Polygon). Admin of the live Polygon lending stack.
- **Polygon treasury Safe** `0xdF46A5083C01C82b2e70fF97E9cf27fC80000851` → wrapper admin.
- **Story signer** `0x3D56B28516282143B347BE5A1de4301d5A91fc9d` (key `WALLET_PRIVATE_KEY` in `~/story-mcp-hub/story-sdk-mcp/.env`; ~7.64 IP) → escrow deployer.
- **Keeper EOA** — DEDICATED, generate fresh (`cast wallet new`); fund with POL (Polygon) + IP (Story). Holds `MESSENGER_ROLE` only.
- `MESSENGER_ROLE` = `0x9169014801faeffeb0ffa6d3da58be378861e512c765e75a348579eecb031854`

Lending stacks (⚠️ re-confirm each ABI via Blockscout `get_contract_abi` before the wiring step):

| | Polygon 137 | Arbitrum 42161 |
|---|---|---|
| DiggerRegistry | `0x151c4752A875dc5CE40A466bc85F85Ece6756e86` | `0x090275f1ddae9e37C28D495AD9f9044723D787c9` |
| NFTValuer | `0xD6F819B0Ea9091988D38D937fC6745E142990Ba8` | `0x83b946C721a0B5f5871DC91F884b364D1410f131` |
| LendingPool | `0x2e5b111447a93ca2b900e9da96822344d6Be49eC` | `0xc2f02Dff81d019d10d23d9A29bC774830D54290E` |

---

## 0. Keeper EOA

```sh
cast wallet new                       # save address + key securely
# fund it: POL on Polygon, IP on Story (a few $ each is plenty for the pilot)
export KEEPER=0x<keeper-address>
```

## 1. Escrow → Story (1514)

⚠️ **EVM-version check first.** solc 0.8.24 defaults to `cancun`; forge raised the
EIP-3855 (PUSH0) notice for Story. Story runs modern Solidity (SPG/IP contracts),
so it's almost certainly fine — but to be safe, pin Shanghai in `foundry.toml`
(`evm_version = "shanghai"`), `forge build`, re-run the dry-run, then broadcast.

```sh
cd contracts
export DEPLOYER_PK=$(grep '^WALLET_PRIVATE_KEY=' ~/story-mcp-hub/story-sdk-mcp/.env | cut -d= -f2-)   # IP-funded Story signer
ESCROW_ADMIN=0x3D56B28516282143B347BE5A1de4301d5A91fc9d \
ESCROW_KEEPER=$KEEPER \
  forge script script/DeployEscrowStory.s.sol --rpc-url https://mainnet.storyrpc.io --slow --broadcast
```

Record the printed `RoyaltyEscrow:` address and its deploy block. The script already
grants `MESSENGER_ROLE` to `$KEEPER`. (Story has no Safe — `ESCROW_ADMIN` is the
Story signer for the pilot; rotate to a multisig before scaling.) Story isn't on
Etherscan — verify via storyscan if/when supported.

## 2. Wrapper → Polygon (137)  [primary venue]

```sh
export $(grep '^DEPLOYER_PK=' ~/.env)         # deployer (has POL)
WRAPPER_ADMIN=0xdF46A5083C01C82b2e70fF97E9cf27fC80000851 \
WRAPPER_KEEPER=$KEEPER \
  forge script script/DeployWrapper.s.sol \
  --rpc-url https://polygon-bor-rpc.publicnode.com --slow --broadcast \
  --verify --chain 137 --etherscan-api-key "$(grep '^ETHERSCAN_API_KEY=' ~/.env | cut -d= -f2-)"
```

Record `RoyaltyAdvanceWrapper:` address + deploy block. (Etherscan V2 key verifies
Polygon via `chainid=137` — same as Phase 0. If verify flakes, re-run
`forge verify-contract --chain 137 ...` after.)

## 3. (optional) Wrapper → Arbitrum (42161)

Same command, `--rpc-url $ARB_RPC --chain 42161`, `WRAPPER_ADMIN=<Arb Safe>`. Only
needed if you also want to borrow on Arb; the keeper watches it for burns but does
NOT mint there (primary venue stays Polygon unless you change
`ROYALTY_PRIMARY_VENUE_CHAINID`).

## 4. Wire wrapper into the Polygon lending stack

The Polygon DiggerRegistry/NFTValuer admin is the **deployer EOA**, so these are
plain `cast send`s (no Safe tx). Wrapper is its own valuer ⇒ collection == valuer.

```sh
export WRAP=0x<polygon-wrapper>
export PK=$(grep '^DEPLOYER_PK=' ~/.env | cut -d= -f2-)
RPC=https://polygon-bor-rpc.publicnode.com

# 4a. point the collection at itself in mirror mode (clamp=0)
cast send 0xD6F819B0Ea9091988D38D937fC6745E142990Ba8 \
  "setMirrorMode(address,address,uint256)" $WRAP $WRAP 0 --private-key $PK --rpc-url $RPC

# 4b. register IN_HOUSE @ 15% LTV (maxLtvBps>0 ⇒ isCollateral)
cast send 0x151c4752A875dc5CE40A466bc85F85Ece6756e86 \
  "registerInHouseCollection(address,address,uint256)" $WRAP $WRAP 1500 --private-key $PK --rpc-url $RPC

# 4c. verify
cast call 0x151c4752A875dc5CE40A466bc85F85Ece6756e86 "isListable(address)(bool)"   $WRAP --rpc-url $RPC
cast call 0x151c4752A875dc5CE40A466bc85F85Ece6756e86 "isCollateral(address)(bool)" $WRAP --rpc-url $RPC
```

Both should return `true`. (For Arb, repeat against the Arb stack — and confirm the
Arb registry admin is still the deployer before assuming `cast send` works.)

## 5. Configure + activate the keeper (OBSERVE first)

```sh
cp ~/market-data-workflow/.royalty-advance.env.example ~/.royalty-advance.env
chmod 600 ~/.royalty-advance.env
# fill: ROYALTY_ESCROW_ADDRESS, ROYALTY_STORY_FROM_BLOCK,
#       ROYALTY_VENUES=[{"chainId":137,"rpc":"https://polygon-bor-rpc.publicnode.com","wrapper":"<WRAP>","fromBlock":<block>}],
#       ROYALTY_ADVANCE_KEEPER_KEY=<keeper key>
#       leave ROYALTY_ADVANCE_EXECUTE=0 and ROYALTY_DEFAULT_VALUE_USDC=0 for now

cd ~/market-data-workflow
pm2 restart market-data-worker          # load the new workflow/activity code
npm run run-once:royalty                # expect: scans clean, 0 findings (no locks yet)
npm run schedule:royalty                # create royalty-advance-watch-15m
pm2 save
```

## 6. First end-to-end advance (flip execution)

1. Set a conservative value for the test position — either `ROYALTY_DEFAULT_VALUE_USDC`
   (6-dec) or a `ROYALTY_VALUE_OVERRIDES` entry for its escrowRef.
2. Artist: `approve` RT to the escrow, then `lockForAdvance(rtToken, amount, ipAsset)`
   on Story → note the emitted `escrowRef`.
3. Set `ROYALTY_ADVANCE_EXECUTE=1`, `pm2 restart market-data-worker`.
4. Keeper mints the mirror on Polygon (tokenId == uint256(escrowRef)); confirm via
   `cast call <WRAP> "ownerOf(uint256)(address)" <id>`.
5. Borrow USDC against the mirror through LendingPool `0x2e5b…49eC`; repay; withdraw
   the mirror; `burnAndRedeem(id)`.
6. Keeper sees `BurnRequested` → `releaseEscrow` on Story → RT returns to the artist.

All `royalty.advance.*` events land on `funnel-events` → Telegram throughout.

## Rotations / hygiene (before scaling past the pilot)
- Move escrow `DEFAULT_ADMIN_ROLE` to a Story multisig; wrapper admin is already the Polygon Safe.
- Restore the Polygon DiggerRegistry `minBond` to 1000 USDC (dropped to 0.1 for onboarding).
- Wire a real trailing-12mo revenue source into the keeper's `conservativeValueUsdc`.
- Counsel sign-off + the marketing/security firewall in `docs/BRMG-ECONOMY.md` still apply.
