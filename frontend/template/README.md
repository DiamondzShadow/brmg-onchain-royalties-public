# BRMG dApp — Lovable starter template

A minimal thirdweb-v5 scaffold for the BRMG frontend. It encodes the three patterns
Lovable tends to get wrong — the **two-chain wiring** (custom Story 1514 + Polygon 137),
the **compliance gate** for securities, and the **keeper-async polling** — so the rest
of the app can be generated against working code instead of guesses.

These files are the *pattern*, not the whole app. Drop them in, then let Lovable build
the remaining screens (Catalog, Membership, Advances, Market) following the same shape.

## What's here
```
.env.example                     VITE_THIRDWEB_CLIENT_ID
src/lib/thirdweb.ts              thirdweb client
src/providers.tsx                <ThirdwebProvider> wrapper
src/components/ConnectBar.tsx    ConnectButton (Polygon + custom Story chain)
src/components/ComplianceGate.tsx  wrap any securities "acquire" action
src/hooks/useBrmg.ts             brmgContracts(client) + useCompliance() gate
src/hooks/useKeeperPoll.ts       poll chain state while the keeper bridges (async)
src/pages/Feeder.tsx             reference screen: read + write + gate + poll
```

## Use it
1. Copy `../src/config/brmg.ts` and `../src/config/brmgAbis.ts` into the Lovable app's
   `src/config/` — that's the single source of truth for chains/addresses/ABIs. **Never
   hardcode an address; import from there.** The only dynamic address is a work's
   fan-pool mirror — resolve via `mirrorShareFactory.mirrorOf(rtToken)` (`0x0` until bridged).
2. Copy these template files into the app (same `src/` layout). They use the `@/` alias.
3. Set `VITE_THIRDWEB_CLIENT_ID` in Lovable's environment.
4. Paste the master prompt below into Lovable, then point it at these files as the pattern.

## thirdweb v5 notes (baked into the code)
- Reads: `useReadContract({ contract, method: "name", params })` — works because the
  config's contracts carry their ABI.
- Writes: `prepareContractCall(...)` + `useSendTransaction()`.
- Keeper-only functions (`mintMirror` / `fundFanPool` / `releaseShares` / `releaseEscrow`)
  are **never** called from the client — the UI signs the user-side tx and polls.

### Wallet & gasless — the EOA-first structure (learned the hard way)
Configure gasless **on the `inAppWallet`** via `executionMode`, NOT the `accountAbstraction`
prop on `<ConnectButton>` — see `ConnectBar.tsx`:
```ts
inAppWallet({
  auth: { options: ["email", "google", "passkey"] },
  executionMode: { mode: "EIP7702", sponsorGas: true },   // same EOA address, gasless
})
```
- The `accountAbstraction` ConnectButton prop is **EIP-4337**: it wraps *every* connected
  wallet (MetaMask included) into a smart-contract account with a **different address** and
  needs heavier setup — using it on a clientId without AA configured **throws and breaks the
  connect button**. Don't reach for it for an EOA-first app.
- `executionMode: EIP7702` keeps the **same EOA address** (so a test wallet stays a stable,
  fundable address) and sponsors gas on chains that support 7702. If a chain isn't 7702-enabled
  for your client, use `{ mode: "EIP4337", smartAccount: { chain, sponsorGas: true } }`.
- **Cost:** thirdweb includes **1,000 sponsored txns free**, +2.5% mainnet surcharge beyond that;
  Polygon gas is sub-cent — so gasless is effectively free for testing and early usage.
- The EIP-7702 in-app wallet **supports `sendBatchTransaction`** (one-tap approve+pledge). A
  plain external wallet (MetaMask, no 7702) can't batch → fall back to sequential approve → pledge.
- thirdweb wallet UI is **client-only**: in TanStack Start / any SSR setup, gate the
  `<ConnectButton>` behind a mounted check (as `ConnectBar.tsx` does) or it trips the error boundary.
- Refs: [in-app wallet](https://portal.thirdweb.com/typescript/v5/inAppWallet) · [EIP-7702 smart accounts](https://blog.thirdweb.com/changelog/next-gen-smart-accounts/) · [pricing](https://thirdweb.com/pricing)

## Master prompt
```
Build a Web3 dApp for "BRMG — Billionaires Row Music Group", an on-chain music
royalties protocol. Stack: React + Vite + TypeScript + Tailwind + shadcn/ui + thirdweb v5.

CONTRACT TRUTH: src/config/brmg.ts and src/config/brmgAbis.ts already define every
chain, address, ABI, and a brmgContracts(client) helper. ALWAYS import from there.
NEVER hardcode or invent an address. The only dynamic address is a work's fan-pool
mirror — resolve it via mirrorShareFactory.mirrorOf(rtToken) (it's 0x0 until bridged).

Two chains (support thirdweb ConnectButton + chain switching):
 • Story (1514, custom chain in config) — Royalty Tokens, revenue, advance escrow, fan-pool locker.
 • Polygon (137) — $BRMG, membership, mirrors, lending, graduation/feeder/compliance/market.

Cross-chain bridge + advances are KEEPER-MEDIATED and ASYNC: the user signs ONE tx,
then the UI POLLS chain state until the keeper's result appears (minutes). Never call
mintMirror / fundFanPool / releaseShares / releaseEscrow from the client — keeper-only.

SECURITIES vs UTILITY firewall:
 • Securities (Royalty Tokens, fan-pool mirror shares, RoyaltyShareMarket, claimShares):
   gate every acquire on ComplianceRegistry.canHold(address) → show a "KYC required" state.
 • Utility (open): $BRMG, membership, warrant reads, pledging USDC.

Screens (use the provided hooks/components as the pattern for all of them):
 1. Catalog — WORKS list; per work show the 70/10/20 split + read-only revenue/claim.
 2. Membership — $BRMG tier from membership.tierOf(); show thresholds + progress.
 3. Advances — artist locks Royalty Tokens → mirror NFT → borrow USDC @15% LTV; async status.
 4. Feeder — BR12 campaigns: pledge USDC, stream progress to graduation, claim fan-pool shares (gated).
 5. Market — RoyaltyShareMarket list/fill/cancel of fan-pool share lots (taker gated).

Design: dark, premium music-label aesthetic, mobile-first. Empty states render the
brand shell (hero + rails), never a blank screen. Use TanStack Query (thirdweb ships it).
```

## Per-screen prompts

Lovable builds best in passes. After the master prompt scaffolds the app, paste these
**one at a time**. Feeder already has a reference file (`src/pages/Feeder.tsx`); build
Advances last — it's the only flow touching both chains.

### Catalog
```
Build the Catalog screen. Import useWorks + useBrmg from @/hooks/useBrmg and
WORKS/RT_TOTAL_SUPPLY/explorer from @/config/brmg.

For each work in useWorks() render a card:
 • title, and the splits array as labelled rows (artist 70% / producer 10% / fan_pool 20%).
 • Royalty Token: useReadContract(royaltyToken(work.royaltyToken), "symbol"/"totalSupply").
 • The connected wallet's RT balance: royaltyToken(rt) "balanceOf" [account] (6 decimals).
 • A "View IP on Story" link → explorer.storyIp(work.ipAsset).

Revenue: claiming pro-rata revenue needs the Story SDK (@story-protocol/core-sdk
claimAllRevenue) which is out of scope for thirdweb — for now show the holder's RT
balance + the Story Explorer link, with a "Claim revenue" button that's disabled with
a tooltip "claim via Story". Viewing is open (no compliance gate); only acquiring RT is gated.

Dark card grid, mobile-first, render the brand shell even with one work.
```

### Membership
```
Build the Membership screen ($BRMG utility — NO compliance gate, this is open).
Import useBrmg + MEMBERSHIP_TIERS, BRMG_TOKENOMICS from @/config/brmg.

Reads (Polygon), all via useReadContract on useBrmg() contracts:
 • membership "tierOf" [account] → uint8; label = MEMBERSHIP_TIERS[tier].
 • membership "effectiveBalance" [account] → held+locked $BRMG that counts toward tier.
 • membership "thresholds" [i] for i = 1..4 (Bronze/Silver/Gold/Platinum cutoffs).
 • brmgToken "balanceOf" [account] and "decimals" (18).

Show: a tier badge (None→Platinum), the effective balance, and a progress bar to the
NEXT threshold (effectiveBalance vs thresholds[tier+1]). Add a small "tokenomics" footer
from BRMG_TOKENOMICS (1B cap, 200M genesis, treasury Safe). Premium dark UI.
```

### Advances (cross-chain flagship — build last)
```
Build the Advances screen. Artist-only: lock Royalty Tokens on Story → keeper mirrors an
NFT on Polygon → borrow USDC against it @15% LTV. Import useBrmg, mirrorTokenId,
ADVANCE_LTV_BPS, RT_DECIMALS from @/config/brmg. This spans BOTH chains and is keeper-async.

STEP 1 — lock (Story): pick a work; royaltyToken(rt) "approve" [royaltyEscrow.address, amount]
then royaltyEscrow "lockForAdvance" [rt, amount, ipAsset]. Capture escrowRef from the Locked
event (or read royaltyEscrow positions). Then show "Bridging — keeper is minting your
mirror…" and POLL advanceWrapper "ownerOf" [mirrorTokenId(escrowRef)] on Polygon until it
returns the artist (use refetchInterval, like useKeeperPoll). Never call mintMirror yourself.

STEP 2 — borrow (Polygon, once minted): read advanceWrapper "estimatePositionValue"
[tokenId] → total (USDC, 6dec) and diggerRegistry "isCollateral" [advanceWrapper.address].
maxBorrow = total * ADVANCE_LTV_BPS / 10000. advanceWrapper "approve" [lendingPool.address,
tokenId], then lendingPool "borrow" [advanceWrapper.address, tokenId, borrowAmount].
Handle a revert gracefully (the pilot pool may have no USDC liquidity → show "pool liquidity
unavailable").

STEP 3 — manage: lendingPool "activeLoanOf"/"debtOf"/"loanHealthBps". Repay: usdc "approve"
[lendingPool.address, amt] + lendingPool "repay" [loanId, amt]. Redeem RT: advanceWrapper
"burnAndRedeem" [tokenId] → then POLL royaltyEscrow "positions" [escrowRef] until status==2
(Released) on Story. Render the three steps as a clear stepper with per-step live state.
```

### Market
```
Build the secondary Market screen for fan-pool shares (RoyaltyShareMarket). These ARE
securities — wrap every buy/sell in <ComplianceGate>. Import useBrmg from @/hooks/useBrmg.

Browse: read shareMarket "nextOrderId", then shareMarket "orders" [i] for i = 1..nextOrderId-1;
show rows where active==true: (shareToken, shareAmount, askAmount in USDC, maker). Amounts
are 6 decimals.

Buy (fill) — gated: payAmount = askAmount * fillShares / shareAmount (pro-rata). usdc "approve"
[shareMarket.address, payAmount], then shareMarket "fill" [orderId, fillShares].

Sell (list) — gated: the maker holds mirror shares for a work (resolve the mirror via
mirrorShareFactory "mirrorOf" [rtToken]). mirrorShare(shareToken) "approve" [shareMarket.address,
shareAmount], then shareMarket "list" [shareToken, usdc.address, shareAmount, askAmount].

Cancel: shareMarket "cancel" [orderId] (maker only). Note a protocol fee (≤2.5%) goes to
treasury on fills. Dark order-book style table, mobile-first.
```
