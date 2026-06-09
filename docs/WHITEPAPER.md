# Billionaires Row Music Group (BRMG) — Token Whitepaper

**Version 1.0 — June 2026**

> **Disclaimer.** This document describes a technical system and an economic design. It is
> not investment advice, an offer to sell, or a solicitation of any security. The utility
> token (`$BRMG`) and the revenue-bearing instruments (Royalty Tokens, Catalog Shares)
> described here are **distinct** by design; the revenue-bearing instruments are intended
> to be offered, if at all, only through a compliant, counsel-supervised structure with KYC
> and transfer restrictions. Nothing here is legal advice.

---

## Abstract

A record label is, mechanically, a bundle of services: it fronts **capital** (advances),
does **accounting** (royalty splits and payouts), runs **A&R** (discovery and funding), and
controls **distribution**. In exchange it takes ownership of the master and pays opaque,
delayed, hard-to-audit statements.

BRMG unbundles that bundle into on-chain primitives. Every release becomes a **Story
Protocol IP Asset** whose revenue is represented by a **Royalty Token (RT)** — an ERC-20
that splits income programmatically and in real time to everyone with a stake, including
fans. Those same tokens become **productive collateral**: an artist can borrow against their
future royalties without surrendering ownership. A separate, free **utility token (`$BRMG`)**
powers coordination, access, and membership — kept legally distinct from the revenue-bearing
side.

The result reroutes wealth from the label to the people who create and sustain the music,
using infrastructure that is already audited and, as of this writing, **already live and
proven on mainnet**.

---

## 1. The problem with music royalties today

- **Opacity.** Artists receive quarterly statements they cannot independently verify.
- **Latency.** Money sits in label/PRO float for months before reaching creators.
- **Ownership.** The label owns the master; the artist rents their own work back.
- **Exclusion.** Fans who *make* a song a hit capture none of its upside.
- **Illiquidity.** Future royalties are real value an artist cannot easily access without
  predatory advance terms.

Prior "music NFT" and "royalty token" attempts (circa 2021) mostly re-created dividend
coupons: a token that pays a cut, with no composability and no real rights. They missed the
point — the innovation isn't *tokenizing a payout*, it's making the **ownership itself**
programmable, claimable, and usable across DeFi.

## 2. Design principles

1. **Don't reinvent custody or law.** Build on Story Protocol's audited royalty
   infrastructure and battle-tested DeFi components; write the minimum new Solidity.
2. **Separate the security from the utility.** A token that pays revenue is a security and
   needs KYC + transfer restrictions. You cannot bolt that onto a freely-tradable utility
   token, so BRMG uses **two distinct tokens**.
3. **Ownership is the product.** The Royalty Token *is* the artist's stake. Everything else
   (advances, lending, fan rewards) is something you can *do* with it once you hold it.
4. **Ship independently, prove on-chain.** Each phase deploys and is verifiable on mainnet
   before the next begins. No phase depends on the unproven.

## 3. Architecture overview

BRMG spans **two chains**, each chosen for what it does best:

| Layer | Chain | Why |
|---|---|---|
| IP registration, Royalty Tokens, revenue | **Story Protocol (1514)** | purpose-built IP-Asset + royalty infrastructure, audited |
| Utility token, advances/lending collateral | **Polygon (137)** | deep liquidity, cheap, where `$BRMG` lives |
| (optional second advance venue) | Arbitrum (42161) | the more battle-tested lending stack |

Because Story is **not** on a generalized cross-chain messaging layer (no Chainlink CCIP
lane), the two chains are linked by a **trusted, durable keeper** (a Temporal workflow holding
a `MESSENGER_ROLE`) rather than a bridge — see §6.

## 4. The Royalty Token (the asset)

When a work is registered, a single audited transaction
(`mintAndRegisterIpAndAttachPILTermsAndDistributeRoyaltyTokens`):

1. **Mints** an SPG NFT into the BRMG catalog collection (the on-chain "master").
2. **Registers** it as a Story **IP Asset** (an ERC-6551 account that holds the rights).
3. **Attaches PIL terms** — commercial use, a revenue-share %, reciprocal derivatives (so any
   remix/sample registered downstream pays royalties **upstream** automatically).
4. **Deploys an IP Royalty Vault** and **distributes its 100,000,000 Royalty Tokens (RT)** to
   the stakeholders — by configurable split.

The RT is a plain ERC-20 (6-decimal, `totalSupply = 100,000,000`). **Hold X% of the RT, claim
X% of every dollar that flows into the vault.** Revenue paid in (via
`payRoyaltyOnBehalf`, by licensees, or by derivative works) is claimed pro-rata with
`claimAllRevenue`. No label, no PRO float, no quarterly statement.

**The split (configurable per work).** Example genesis split:

| Stakeholder | Share |
|---|---|
| Artist | 70% |
| Producer / collaborators | 10% |
| Fan pool | 20% |

The artist owns the majority from day one. The **fan pool** holds an allocation distributed,
in a later phase, to the listeners who drove the song (§7, Phase 3). Splits are denominated in
Story's millionths and must sum to exactly 100% or the distribution reverts.

## 5. `$BRMG` — the utility token

`$BRMG` is the **non-security** coordination and access layer: a free, liquid ERC-20 on
Polygon used for membership, platform access, gifting, and ecosystem incentives. It carries
**no claim on catalog revenue** — that is what keeps it distinct from the Royalty Tokens.

**Supply logic.**

| Parameter | Value | Rationale |
|---|---|---|
| Max supply (hard cap) | **1,000,000,000** | fixed ceiling; capped ERC-20, can never inflate past it |
| Genesis mint | **200,000,000 (20%)** to the treasury Safe | lean initial float → low sell pressure; seeds membership/liquidity |
| Reserved | **800,000,000 (80%)**, unminted | minted over time **only by the multisig treasury**, tied to real ecosystem growth (fan rewards, liquidity, onboarding) |
| Deployer rights | renounced | minting/admin held by the Safe, not an individual |

The logic: **cap for scarcity, a small honest genesis float, and a large reserve whose
issuance is governed and demand-driven** — supply grows with adoption rather than being dumped
at launch.

**Membership & utility mechanics.** Held-and-locked `$BRMG` confers tiered membership
(Bronze / Silver / Gold / Platinum). A spend "sink" burns a portion of `$BRMG` used for
platform actions (deflationary pressure proportional to usage). An advisory **signal** module
lets holders weigh in on non-binding polls via historical balance snapshots.

## 6. DeFi primitives — royalties as productive collateral

The headline financial primitive: an artist can take an **advance** against future royalties
**without selling them**.

1. The artist **locks** Royalty Tokens into a `RoyaltyEscrow` on Story.
2. The keeper observes the lock, computes a **conservative valuation** (trailing-12-month
   claimed revenue × 1.0), and mints a 1:1 **mirror NFT** (`RoyaltyAdvanceWrapper`) on
   Polygon, valued at that figure.
3. The mirror is recognized by the existing lending stack as collateral; the artist borrows
   USDC at a conservative **15% LTV**.
4. To unwind: repay, withdraw the mirror, **burn** it. The keeper observes the burn and
   **releases** the Story escrow — the Royalty Tokens return to the artist.

**Why a keeper, not a bridge.** Story has no Chainlink CCIP lane. Rather than trust a
generalized bridge, BRMG uses a durable `MESSENGER_ROLE` keeper (a Temporal workflow) that
only ever moves *custody state* between two contracts BRMG itself owns — minting a mirror
when RT is locked, releasing the escrow when the mirror is burned. It cannot move funds
arbitrarily, and execution is fail-closed (a position is un-collateralizable until a
conservative value is explicitly set). CCIP-ready hooks remain for when a lane exists.

This is the genuinely new part: royalties are not a dividend coupon but a **liquid, composable
collateral asset** — an artist's catalog becomes a credit line they fully own.

## 7. Roadmap — each phase ships and is proven independently

| Phase | Deliverable | Status |
|---|---|---|
| **0** | `$BRMG` utility token on Polygon (non-security) | **Live** |
| **1** | Per-song Royalty Tokens — register IP + atomic revenue split | **Live (first RT minted, split & claim proven)** |
| **2** | Royalty-collateral advances (lock → mirror → borrow) | **Live (round-trip proven on-chain)** |
| **3** | Proof-of-fandom minting — a WAVS oracle distributes the fan-pool share to listeners who drove a song | Designed |
| **4** | Catalog-Shares security token — a restricted (ERC-1404 + allowlist), KYC'd, Reg A+ instrument aggregating per-song vault flows | Designed, counsel-gated |

Distribution remains BRMG's moat (the Virgin/major pipe): the protocol reroutes the *capital,
accounting, and A&R* on-chain while keeping the distribution relationship that gets music
heard.

## 8. Proof of deployment (verifiable now)

Unlike most token papers, the core claims here are **already on mainnet**:

**Polygon (137)** — `$BRMG` (Phase 0), Polygonscan-verified:
- BRMGToken `0x1f92cdCfd3c172dD8b40287188dEC7331059575C` — 1B cap, 200M minted to Safe `0xdF46A5083C01C82b2e70fF97E9cf27fC80000851`, deployer renounced admin/minter.

**Story (1514)** — Royalty Token (Phase 1), live:
- IP Asset `0xb2779bf818f9C5e8A35c9ee6b2a5FC2B45401D2b` (catalog token #4),
  Royalty Token / vault `0x5361cB2A1FE33a22358b577c38916b6D3323469B` — 100M RT split
  70/10/20, **verified on-chain**.
- **Revenue claim proven:** 1 WIP paid into the vault was claimed exactly **0.7 / 0.1 / 0.2**
  by the three holders, in proportion to their RT — the vault drained to zero.

**Phase 2 advances, live + round-trip-proven:**
- RoyaltyEscrow (Story) `0x85d9d5c771fe63a27f8cf426b9f894fc028e8bee`,
  RoyaltyAdvanceWrapper (Polygon, verified) `0xffd7096Ee8403D240a3DBE01Df57477cA9393571`.
- Demonstrated end-to-end: artist locked RT → keeper minted a valued, collateral-eligible
  mirror on Polygon → artist burned it → keeper released the escrow → RT returned.

Open-source: <https://github.com/DiamondzShadow/brmg-onchain-royalties-public>.

## 9. Governance & treasury

- All privileged roles target the **multisig treasury Safe**, not individuals; the deployer
  renounced rights on the live utility token.
- `$BRMG` issuance from the 80% reserve is a treasury action — governed, demand-driven.
- The advisory **signal** module gives holders a non-binding voice via balance snapshots
  (binding on-chain governance is a future consideration, not a launch claim).

## 10. Risk factors

- **Securities risk.** Royalty Tokens and Catalog Shares are revenue-bearing and may be
  securities; they are gated, KYC'd, and counsel-supervised by design, and are **not** the
  utility token. Misuse or unrestricted public trading of revenue-bearing instruments is a
  legal risk the protocol explicitly designs against.
- **Keeper trust (Phase 2).** The cross-chain keeper is trusted not to release an escrow
  before its Polygon advance is settled. It is intra-protocol (BRMG owns both sides), runs on
  durable infrastructure, and is fail-closed; a CCIP lane would remove the trust assumption.
- **Valuation risk.** Advances are valued conservatively (trailing revenue, 15% LTV); a real
  revenue oracle replaces the placeholder before scale.
- **Liquidity risk.** Drawing an advance requires USDC liquidity in the lending pool.
- **Smart-contract risk.** Mitigated by building on audited Story periphery and minimal new
  Solidity, but not eliminated.

## 11. Conclusion

BRMG turns a record label into a set of open, composable on-chain primitives: ownership that
is **tokenized**, revenue that is **auto-split and claimable**, royalties that are **productive
collateral**, and a utility layer that is **legally clean**. The mechanism is not a promise —
it is deployed, verified, and proven on mainnet today. What remains is to grow the catalog,
wire the fan economy, and supply the capital — building the rest on a foundation that already
works.

---

*See [`BRMG-ECONOMY.md`](BRMG-ECONOMY.md) for the engineering thesis and component map, and
[`../contracts/`](../contracts/) for the Phase-2 contracts, tests, and deploy runbook.*
