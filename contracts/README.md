# BRMG Phase 2 — Royalty-Collateral Advances

On-chain contracts for the **royalty-collateral advance** primitive: an artist
locks their Royalty Tokens on **Story (1514)** and borrows USDC against a
conservatively-valued mirror on **Polygon (137)**. This is the "capital/advances"
leg of the label-unbundled-into-DeFi design (see `../docs/BRMG-ECONOMY.md`).

## Why a keeper, not CCIP

Story mainnet (1514) is **not** on Chainlink CCIP — the `chain-selectors`
registry only has `story-testnet` (1513) and the CCIP directory has no Story
mainnet page. So the two legs are coordinated by a trusted off-chain keeper
holding `MESSENGER_ROLE` on both contracts, rather than `ccipReceive`. The trust
is intra-protocol (BRMG owns both the escrow and the lending venue); CCIP-style
action codes live in the keeper so this can swap to a real lane if Story adds one.

This mirrors `ShadowVaultV15/contracts/ccip/{ArbPositionWrapper,PolygonNFTLocker}`
with the CCIP message path replaced by keeper calls.

## Contracts

| Contract | Chain | Role |
|---|---|---|
| `RoyaltyEscrow.sol` | Story 1514 | Artist locks ERC-20 Royalty Tokens; keeper releases on repayment. |
| `RoyaltyAdvanceWrapper.sol` | Polygon 137 | ERC721 mirror minted by keeper; its own valuer (`estimatePositionValue → (0,0,lastValueUSDC)`); `burnAndRedeem` signals release. |

### Flow

1. Artist `lockForAdvance(rtToken, amount, ipAsset)` on Story → emits `escrowRef`.
2. Keeper observes `Locked`, computes conservative value (trailing-12mo claimed
   revenue × 1.0), calls `mintMirror(escrowRef, artist, valueUSDC)` on Polygon.
3. Artist borrows USDC against the mirror via the Polygon lending stack.
4. Keeper refreshes value periodically via `pushValue`.
5. Artist repays, withdraws the mirror from the pool, `burnAndRedeem(id)`.
6. Keeper observes `BurnRequested` → `releaseEscrow(escrowRef)` on Story.

`tokenId == uint256(escrowRef)` — deterministic, one escrow ⇒ one mirror.

## Build

`lib/` is git-ignored and symlinked to the sibling `echo-creator-nest` OZ v5 +
forge-std checkout (avoids a second submodule tree). Recreate it before building:

```sh
mkdir -p lib
ln -sfn ../../echo-creator-nest/contracts/lib/openzeppelin-contracts lib/openzeppelin-contracts
ln -sfn ../../echo-creator-nest/contracts/lib/forge-std            lib/forge-std
forge build
forge test          # 18/18 green
```

(Or `forge install OpenZeppelin/openzeppelin-contracts@v5 foundry-rs/forge-std`.)

## Deploy (dry-run by default; add `--broadcast`)

```sh
# Story escrow
DEPLOYER_PK=… ESCROW_ADMIN=<safe> ESCROW_KEEPER=<keeper> \
  forge script script/DeployEscrowStory.s.sol --rpc-url $STORY_RPC --slow

# Polygon wrapper
DEPLOYER_PK=… WRAPPER_ADMIN=<polygon-safe> WRAPPER_KEEPER=<keeper> \
  forge script script/DeployWrapperPolygon.s.sol \
  --rpc-url https://polygon-bor-rpc.publicnode.com --slow
```

## Wiring (after deploy, per chain)

The same wrapper can be registered on **either or both** advance venues — Arb's
stack is the more battle-tested (CrabbyPresale V4 borrows live there with a
working `/borrow` FE); Polygon mirrors $BRMG's home chain. ⚠️ Re-confirm each
ABI via Blockscout `get_contract_abi` before broadcasting; the signatures in
`src/interfaces/IBrmgLending.sol` are reconstructed from memory.

**Polygon 137** (stack verified 2026-04-20):

| | address |
|---|---|
| DiggerRegistry | `0x151c4752A875dc5CE40A466bc85F85Ece6756e86` |
| NFTValuer | `0xD6F819B0Ea9091988D38D937fC6745E142990Ba8` |
| LendingPool | `0x2e5b111447a93ca2b900e9da96822344d6Be49eC` |
| USDC (native) | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |

**Arbitrum 42161** (CrabbyPresale V4 path, proven E2E):

| | address |
|---|---|
| DiggerRegistry | `0x090275f1ddae9e37C28D495AD9f9044723D787c9` |
| NFTValuer | `0x83b946C721a0B5f5871DC91F884b364D1410f131` |
| LendingPool | `0xc2f02Dff81d019d10d23d9A29bC774830D54290E` |

```sh
# wrapper is its own valuer ⇒ collection == valuer == <wrapper>
cast send $NFTVALUER     "setMirrorMode(address,address,uint256)"           <wrapper> <wrapper> 0
cast send $DIGGERREGISTRY "registerInHouseCollection(address,address,uint256)" <wrapper> <wrapper> 1500  # 15% LTV
# verify: isListable(wrapper)==true && isCollateral(wrapper)==true
```

## Roles → Safe

`DEFAULT_ADMIN_ROLE` should move to the relevant Safe before mainnet; the keeper
EOA holds `MESSENGER_ROLE` only. Counsel sign-off + the security/marketing
firewall from `../docs/BRMG-ECONOMY.md` still apply before go-live.
```
