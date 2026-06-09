# BRMG On-Chain Royalties

**Register a music work as a Story Protocol IP Asset and split its royalty income to the
artist, collaborators, and fans — atomically, on-chain, in one transaction, with zero
custom Solidity.**

This is the Model-1 *ownership* layer of the BRMG (Billionaires Row Music Group) economy:
the part that actually reroutes wealth. Instead of a label owning the master and paying
out opaque quarterly statements, every release is an IP Asset whose revenue splits
programmatically to everyone who has a stake — including the fans who made it a hit.

See [`docs/BRMG-ECONOMY.md`](docs/BRMG-ECONOMY.md) for the full "unbundle the label into
DeFi primitives" thesis.

---

## ✅ Live on Story mainnet (chain 1514)

The first work is registered and its royalty stream is **owned on-chain right now**:

| | |
|---|---|
| **Royalty Token (RT)** — the asset | **[`0x5361cB2A1FE33a22358b577c38916b6D3323469B`](https://explorer.story.foundation/ipa/0xb2779bf818f9C5e8A35c9ee6b2a5FC2B45401D2b)** |
| IP Asset (the on-chain master) | `0xb2779bf818f9C5e8A35c9ee6b2a5FC2B45401D2b` (catalog token #4) |
| Work | `brmg-r-0001` — *Billionaires Row — Genesis* |
| Supply / split | 100,000,000 RT (6-dec) — **artist 70M · producer 10M · fan-pool 20M**, verified on-chain |
| PIL terms | commercial use, 10% rev-share, derivatives reciprocal |

This RT is a plain ERC-20: the artist can hold it, transfer it, trade it, or post it as
collateral — it **is** their ownership of the song's revenue, with no label in the middle.
That ownership is the product. Everything below (registration) mints it; everything in
[`contracts/`](contracts/) is one thing you can *do* with it once you hold it.

---

## How it works

The factory writes **no new smart contracts**. It drives Story Protocol's audited
periphery workflow `RoyaltyTokenDistributionWorkflows`, calling a single method:

```
mintAndRegisterIpAndAttachPILTermsAndDistributeRoyaltyTokens(
    spgNftContract, recipient, ipMetadata, licenseTermsData, royaltyShares, allowDuplicates
)
```

In one atomic transaction this:

1. **Mints** an SPG NFT into the BRMG catalog collection (the on-chain "master").
2. **Registers** it as a Story **IP Asset** (an ERC-6551 account that owns the rights).
3. **Attaches PIL terms** — commercial use, a revenue-share %, and derivatives allowed.
   Because terms are *reciprocal*, any remix/sample registered as a derivative
   **automatically pays royalties upstream** to this work.
4. **Deploys the IP Royalty Vault** and **distributes its 100,000,000 Royalty Tokens (RT)**
   to the stakeholder addresses you specify. RT are the on-chain claim on the work's
   revenue: hold 20% of the RT, claim 20% of every dollar that flows into the vault.

When revenue is paid into the vault (via Story's `payRoyaltyOnBehalf`, or by licensees /
derivatives), each RT holder pulls their pro-rata share with `claimAllRevenue`. No label,
no lawyers, no quarterly float.

### The split

Each work in the spec carries a `splits` block (human percent, must sum to **exactly 100**):

```json
"splits": [
  {"recipient": "0x…artist",   "role": "artist",   "percentage": 70},
  {"recipient": "0x…producer", "role": "producer", "percentage": 10},
  {"recipient": "0x…fanpool",  "role": "fan_pool", "percentage": 20}
]
```

- **Artist** holds the majority — they own their master, provably, day one.
- **Collaborators** (producer, writer, features…) auto-split their share.
- **Fan pool** holds the fan allocation; the proof-of-fandom layer (a later phase)
  distributes from it to listeners who drove the song.

Percentages are converted to Story's millionths unit (`100% = 100,000,000`) and the
factory **rejects any split that does not sum to exactly 100%** — Story mints exactly
100M RT and partial distribution reverts.

### Idempotent & safe

- Results are appended to `royalty-ledger.json`; re-runs **skip** already-registered works.
- `--dry-run` builds the real transaction and runs `eth_estimateGas` — which **reverts**
  on bad permissions, malformed structs, or a bad split sum — **without sending anything**.
  Always dry-run a new work before spending IP.

---

## Usage

```bash
# from the Story SDK hub venv (see Setup)
cd ~/story-mcp-hub

# validate without spending (recommended first):
.venv/bin/python ~/brmg-onchain-royalties/brmg_royalty_factory.py \
    --spec ~/brmg-onchain-royalties/catalog-royalty.json --backend data --dry-run

# go live (hosts art on Storj, sends the tx, costs ~0.03 IP/work):
.venv/bin/python ~/brmg-onchain-royalties/brmg_royalty_factory.py \
    --spec ~/brmg-onchain-royalties/catalog-royalty.json --backend storj
```

Flags: `--backend ipfs|storj|data` (art/metadata hosting), `--only <key>` (one work),
`--dry-run` (estimate, no send).

---

## Verified on-chain (Story mainnet, chain 1514)

All confirmed to hold bytecode via `eth_getCode` against `https://mainnet.storyrpc.io`:

| Contract | Address |
|---|---|
| RoyaltyTokenDistributionWorkflows (the workflow we call) | `0xa38f42B8d33809917f23997B8423054aAB97322C` |
| RoyaltyModule | `0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086` |
| BRMG catalog SPG collection | `0x020CE1b10Ce744Fc876633fD4B8b3b06fC426c76` |
| **brmg-r-0001 IP Asset** (first royalty-split work) | `0xb2779bf818f9C5e8A35c9ee6b2a5FC2B45401D2b` (token #4) |
| **brmg-r-0001 Royalty Token / vault** | `0x5361cB2A1FE33a22358b577c38916b6D3323469B` |
| PIL terms (10% rev share, derivatives reciprocal) | id `28725` |

Earlier pilot IP Assets (pre-royalty-split, registered by the sibling catalog factory):
`0x718B08c8487c2Cf5509ceE84C2bB8E1d178e5B49` (genesis),
`0xefd6DF4fdE20e79f2025DBaB227172415fa8BFc4` (brmg-0001, real cover art).
Explorer: `https://explorer.story.foundation/ipa/<ip_id>`.

### Phase 2 — what you can do with an RT (deployed + proven E2E)

[`contracts/`](contracts/) adds a **royalty-collateral advance**: lock RT on Story → borrow
against a conservatively-valued mirror on a lending venue. Story isn't on Chainlink CCIP, so
a `MESSENGER_ROLE` keeper bridges the two chains. Live + round-trip-proven on 2026-06-09:

| Contract | Chain | Address |
|---|---|---|
| RoyaltyEscrow | Story 1514 | `0x85d9d5c771fe63a27f8cf426b9f894fc028e8bee` |
| RoyaltyAdvanceWrapper | Polygon 137 (Polygonscan-verified) | `0xffd7096Ee8403D240a3DBE01Df57477cA9393571` |

Proven cycle: artist locked 10M RT → keeper minted a $1,000-valued mirror on Polygon
(collateral-eligible @ 15% LTV via the live NFTValuer/DiggerRegistry) → artist burned it →
keeper released the escrow → RT returned. See [`contracts/DEPLOY-RUNBOOK.md`](contracts/DEPLOY-RUNBOOK.md).

> Polygon (Phase 0 utility-token) contracts verify via the **Etherscan V2** multichain API
> (`https://api.etherscan.io/v2/api?chainid=137`) using `ETHERSCAN_API_KEY` from the
> environment. Story is not on Etherscan; it verifies on storyscan.

---

## Setup

This factory rides on the [`story-mcp-hub`](https://github.com/piplabs) Story SDK service
and its Python SDK (`story_protocol_python_sdk`). It is **not** vendored here — point at an
existing hub checkout.

1. Have `~/story-mcp-hub/story-sdk-mcp` with its `.venv` (provides `services.story_service`
   and `story_protocol_python_sdk`).
2. Copy `.env.example` → `~/.brmg-factory.env` and fill it (see below).
3. Fund the registering wallet with a little IP on Story (~0.03 IP per registration).

### Environment (`~/.brmg-factory.env` + `story-sdk-mcp/.env`)

See [`.env.example`](.env.example). Secrets are **never** committed — `.gitignore` covers
`.env*`. Required: `WALLET_PRIVATE_KEY`, `RPC_PROVIDER_URL`, `BRMG_SPG_CONTRACT`, and (for
`--backend storj`) the Storj S3 + public-linkshare keys.

---

## Files

| File | Purpose |
|---|---|
| `brmg_royalty_factory.py` | Phase-1 register + royalty-token split (this repo's core — mints the RT). |
| `brmg_catalog_factory.py` | Hosting/metadata pipeline (Pinata / Storj / inline data URIs); imported by the royalty factory. |
| `catalog-royalty.json` | Live spec (70/10/20); `brmg-r-0001` registered → `royalty-ledger.json`, re-runs skip it. |
| `contracts/` | Phase-2 royalty-collateral advance (Foundry: RoyaltyEscrow + RoyaltyAdvanceWrapper, 18/18 tests, deployed). See `contracts/README.md` + `DEPLOY-RUNBOOK.md`. |
| `docs/BRMG-ECONOMY.md` | The economic design — label unbundled into DeFi primitives. |

The off-chain `MESSENGER_ROLE` keeper that bridges Story↔venue for the advance lives in the
sibling `market-data-workflow` repo (`royaltyAdvanceWatch`, a 15-min Temporal schedule).

---

## Security

- No private keys, API keys, or `.env` files are committed. Verify with `git ls-files`.
- The registering wallet is a hot key — keep only enough IP on it for gas + registrations.
- Royalty-token recipients must be addresses controlled on Story (they hold an ERC-20 RT
  and claim revenue there).
- Securities note: distributing revenue-bearing royalty tokens to the public can implicate
  securities law. This tooling is infrastructure; offering structure and counsel sign-off
  are out of scope of this repo.
