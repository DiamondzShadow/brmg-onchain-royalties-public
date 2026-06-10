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
