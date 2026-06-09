# BRMG — A Record Label, Unbundled Into DeFi Primitives

> Status: design of record as of 2026-06-09. Supersedes the "3-track" framing in
> `TOKEN-ARCHITECTURE.md` for everything below. Counsel sign-off required before any
> security (catalog-shares) sale; nothing here is legal advice.

## Thesis

Don't tokenize a record label. **Unbundle it.** A major label monetizes four functions
and extracts rent on each. We delete each function and replace it with a battle-tested
crypto primitive that removes the rent — while *keeping* the one function majors are
actually good at (distribution) and routing its revenue through rails we control.

| Label function | The rent extracted | Crypto replacement | Built from |
|---|---|---|---|
| **Capital** (advances) | Owns the master because it fronted cash | Royalty-collateralized lending — borrow against tokenized future streams, non-dilutive, keep the master | Existing LendingPool + AaveV3Sink + Digger registry |
| **Accounting / splits** | Opaque quarterly statements, months of float | Real-time on-chain splits (and optional per-second streaming) | Story Royalty Vault + 0xSplits (+ optional Superfluid) |
| **A&R** (who gets signed) | Captures upside *after* fans made the hit | Fan-funded launches — fans fund pre-release, get royalty tokens cheap, capture the upside they create | Existing Launchpad / TemplatePresale (Aave yield sink) |
| **Distribution** | The one thing they do well | **Keep it** — route the Virgin/major push through on-chain ownership rails | Virgin relationship + CrabbyTV/CCS surfaces |

### What is actually new (not 2021-era dividend tokens)

1. **Royalties as productive collateral, not passive dividends.** The per-song royalty
   token is DeFi-composable: collateral for an advance, AMM liquidity, a leg in the
   catalog index, underlying for a streams-projection market. This is what severs the
   label's capital leverage.
2. **Proof-of-fandom mints ownership.** Streams / shares / playlist-adds — the free
   distribution labor fans give labels today — are measured on-chain (WAVS scorer) and
   mint royalty claims to the fans who drove them. Listening earns equity.
3. **Per-song vaults roll up into a catalog index.** Model 1 (per-song ownership) nests
   inside Model 2 (catalog-level revenue share). Not a fork — a hierarchy.

## Engineering constraint: clean, battle-tested, built for scale

**Write as little new Solidity as possible.** Every custom contract is audit surface and a
place to lose other people's money. Each layer is either (a) an already-audited external
protocol, or (b) something already live in this ecosystem. New code only at the seams
(factory, oracle-minter, security wrapper). Per-song deploys use ERC-1167 minimal proxies
for gas/scale; aggregation avoids O(n) loops.

## Two-token separation (the battle-tested path)

A token that pays a share of catalog revenue **is a security** → it needs transfer
restrictions + KYC. You cannot bolt KYC transfer-gating onto a freely-tradable utility
token without crippling it. Therefore:

- **`$BRMG` — utility / coordination / access.** Free, liquid, non-security. Currency for
  spend sinks, the asset required to bootstrap launches, the access key and advisory-vote
  weight for the whole machine. (Track-A contracts: `BRMGToken/Membership/Sink/Signal`.)
- **`BRMG Catalog Shares` — the revenue share.** A separate, restricted (ERC-1404 +
  allowlist), Reg A+ security token aggregating per-song vault flows. KYC onboarding.
  This is where monetary upside legally lives.

$BRMG still accrues value (launch gating, spend/burn deflation, access) without carrying
the compliance weight on the most-used asset.

## Who shares in the revenue (all four, by design)

- **Artist owns the master** — holds majority royalty tokens + the Story IP Asset, provably, day one.
- **Collaborators auto-split** — revenue routes to their addresses programmatically (0xSplits), no lawyers.
- **Fans share** — via fan-funded launch allocations *and* proof-of-fandom minting.
- **Derivatives pay upstream** — remixes/samples auto-route royalties to the original via Story PIL.

## Component map (load-bearing pieces are audited or already live)

| Layer | Primitive | Status |
|---|---|---|
| Coordination / access | OpenZeppelin v5 (`$BRMG` Track-A) | built, 50/50 tests |
| Per-song IP + royalty accounting | Story Royalty Module + IP Royalty Vault, PIL terms `28722` | live on Story (SPG `0x020CE1b10Ce744Fc876633fD4B8b3b06fC426c76`) |
| Collaborator + fan splits | 0xSplits (+ optional Superfluid streaming, Polygon-native) | audited external |
| Royalty-collateral advances | LendingPool + AaveV3Sink + Digger registry | live in ecosystem |
| Fan-funded launches | Launchpad / TemplatePresale (Aave yield sink) | live in ecosystem |
| Proof-of-fandom oracle | WAVS scorer (writes on-chain multipliers) → capped role-gated minter | scorer live; minter = new (thin) |
| Catalog security | ERC-1404 + allowlist, Reg A+ | new (thin), counsel-gated |
| Per-song scale | ERC-1167 minimal-proxy factory | new (thin) |
| Revenue reconciliation | Temporal keeper (credits-reconcile pattern) | live in ecosystem |
| Distribution | Virgin/major pipe + CrabbyTV/CCS | relationship |

## Build sequence — each phase ships independently, reuses one proven component

- **Phase 0 — utility `$BRMG` on Polygon.** Coordination/access layer. Non-security.
  Deployer mints genesis → all roles handed to Safe `0xdF46A5083C01C82b2e70fF97E9cf27fC80000851`
  → deployer renounces. Defaults: 1B cap, 200M genesis, 20% spend-burn, 30d lock,
  tiers 1k/10k/50k/250k.
- **Phase 1 — per-song royalty vaults (Model 1).** Minimal-proxy factory: register IP in
  the BRMG SPG, create Story Royalty Vault, wire a 0xSplits split (artist-majority +
  collaborators + fan allocation). Derivatives pay upstream via PIL.
- **Phase 2 — royalty-collateral advances.** Register vault tokens as collateral in the
  existing LendingPool. Conservative LTV. The label-capital killer.
- **Phase 3 — proof-of-fandom minting.** WAVS oracle → capped fan royalty claims. Strict
  per-period caps.
- **Phase 4 — catalog-shares security (Model 2).** Restricted Reg A+ token aggregating
  vault flows. Heaviest legal lift, intentionally last.

## The Virgin wedge

Pure-crypto royalty apps (Royal et al.) failed on distribution — dividend apps with no
reach. If we own the platform carrying the BR↔Virgin relationship, we sit between the
major-label distribution machine and the artist: Virgin pushes the song (their strength),
our rails own the capital, accounting, fan-upside, and IP underneath it. We use their
reach and delete their economics — a wedge a pure-crypto competitor structurally can't reach.
