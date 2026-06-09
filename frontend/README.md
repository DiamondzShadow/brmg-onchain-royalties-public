# BRMG frontend config (thirdweb v5 / Lovable)

Drop `src/config/brmg.ts` + `src/config/brmgAbis.ts` into a thirdweb-v5 app.

```ts
import { createThirdwebClient, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { brmgContracts, WORKS, storyChain, polygonChain, ADDR, mirrorTokenId, MEMBERSHIP_TIERS } from "@/config/brmg";

const client = createThirdwebClient({ clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID });
const C = brmgContracts(client);
```

> **Chain switching:** Story actions (RT balance, claim, pay, lock) need the wallet on chain
> **1514**; advance/lending actions need **137**. Prompt `switchChain` before each.

### Read — a holder's stake in a work
```ts
const work = WORKS[0];
const rt = C.royaltyToken(work.royaltyToken);
const balance = await readContract({ contract: rt, method: "balanceOf", params: [account.address] }); // 6-dec
const vault = await readContract({ contract: C.royaltyModule, method: "ipRoyaltyVaults", params: [work.ipAsset] });
```
Claimable revenue + claim: use `@story-protocol/core-sdk` (`client.royalty.claimAllRevenue`) — it
resolves the royalty policy + currency. Don't hand-roll it.

### Pay revenue into a vault (licensee) — Story
```ts
// 1) wrap IP -> WIP, 2) approve the RoyaltyModule, 3) pay
await sendTransaction({ transaction: prepareContractCall({ contract: C.wip, method: "deposit", params: [], value: amount }), account });
await sendTransaction({ transaction: prepareContractCall({ contract: C.wip, method: "approve", params: [ADDR.story.royaltyModule, amount] }), account });
await sendTransaction({ transaction: prepareContractCall({ contract: C.royaltyModule, method: "payRoyaltyOnBehalf", params: [work.ipAsset, work.ipAsset, ADDR.story.wip, amount] }), account });
// ⚠️ approve the RoyaltyModule (not the Workflows contract) — the Story SDK's helper approves the wrong spender.
```

### Start an advance (artist) — Story, then poll Polygon
```ts
// approve RT to the escrow, then lock
await sendTransaction({ transaction: prepareContractCall({ contract: rt, method: "approve", params: [ADDR.story.royaltyEscrow, amount] }), account });
const tx = await sendTransaction({ transaction: prepareContractCall({ contract: C.royaltyEscrow, method: "lockForAdvance", params: [work.royaltyToken, amount, work.ipAsset] }), account });
// read escrowRef from the Locked event, then POLL Polygon for the keeper's mirror:
const id = mirrorTokenId(escrowRef);
const owner = await readContract({ contract: C.advanceWrapper, method: "ownerOf", params: [id] }).catch(() => null); // null until keeper mints
const value = await readContract({ contract: C.nftValuer, method: "liveValue", params: [ADDR.polygon.royaltyAdvanceWrapper, id] }); // 6-dec USDC
```

### Borrow against the mirror — Polygon
```ts
// approve the mirror NFT to the pool, then borrow (<= value * 15%)
await sendTransaction({ transaction: prepareContractCall({ contract: C.advanceWrapper, method: "approve", params: [ADDR.polygon.lendingPool, id] }), account });
await sendTransaction({ transaction: prepareContractCall({ contract: C.lendingPool, method: "borrow", params: [ADDR.polygon.royaltyAdvanceWrapper, id, borrowAmount] }), account });
// repay later: C.lendingPool.repay(loanId, amount); then withdraw NFT and burnAndRedeem(id) -> keeper releases the escrow.
```

### Membership ($BRMG) — Polygon
```ts
const tier = await readContract({ contract: C.membership, method: "tierOf", params: [account.address] }); // 0..4
const label = MEMBERSHIP_TIERS[Number(tier)]; // "None" | "Bronze" | ...
```

### Suggested screens
Catalog → Work/Royalty-Token detail (split, holders, revenue, claim) → Portfolio (RT, claimable,
advances, $BRMG tier) → Advance flow (lock → pending → borrow → repay) → Pay royalty.

### Indexing
For catalog/holders/revenue history, project events into Supabase (the keeper already streams
`royalty.advance.*` to Confluent `funnel-events`); cover art/metadata are on Storj public URLs.
