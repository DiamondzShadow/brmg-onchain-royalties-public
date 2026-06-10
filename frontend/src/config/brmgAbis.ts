// Minimal ABIs for the BRMG dApp — only the functions/events the frontend calls.
// thirdweb v5 accepts these JSON-ABI arrays directly in getContract({ abi }).

/** Standard ERC-20 (Royalty Tokens, USDC, $BRMG). */
export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

/** WIP — wrapped IP, the Story revenue currency (ERC-20 + wrap/unwrap). */
export const wipAbi = [
  ...erc20Abi,
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "v", type: "uint256" }], outputs: [] },
] as const;

/** Story RoyaltyModule — pay revenue into an IP's vault; look up the vault. */
export const royaltyModuleAbi = [
  { type: "function", name: "payRoyaltyOnBehalf", stateMutability: "nonpayable", inputs: [
    { name: "receiverIpId", type: "address" }, { name: "payerIpId", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "ipRoyaltyVaults", stateMutability: "view", inputs: [{ name: "ipId", type: "address" }], outputs: [{ type: "address" }] },
  { type: "function", name: "isWhitelistedRoyaltyToken", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

/** RoyaltyEscrow (Story) — artist locks RT to start an advance; keeper releases. */
export const royaltyEscrowAbi = [
  { type: "function", name: "lockForAdvance", stateMutability: "nonpayable", inputs: [
    { name: "rtToken", type: "address" }, { name: "amount", type: "uint256" }, { name: "ipAsset", type: "address" }], outputs: [{ name: "escrowRef", type: "bytes32" }] },
  { type: "function", name: "positions", stateMutability: "view", inputs: [{ name: "escrowRef", type: "bytes32" }], outputs: [
    { name: "artist", type: "address" }, { name: "rtToken", type: "address" }, { name: "amount", type: "uint256" },
    { name: "ipAsset", type: "address" }, { name: "lockedAt", type: "uint64" }, { name: "status", type: "uint8" }] }, // status: 0 None,1 Locked,2 Released
  { type: "event", name: "Locked", inputs: [
    { name: "escrowRef", type: "bytes32", indexed: true }, { name: "artist", type: "address", indexed: true },
    { name: "rtToken", type: "address", indexed: true }, { name: "amount", type: "uint256" }, { name: "ipAsset", type: "address" }] },
  { type: "event", name: "Released", inputs: [
    { name: "escrowRef", type: "bytes32", indexed: true }, { name: "artist", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
] as const;

/** RoyaltyAdvanceWrapper (Polygon) — ERC-721 mirror; also exposes its own value. */
export const royaltyAdvanceWrapperAbi = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "info", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [
    { name: "escrowRef", type: "bytes32" }, { name: "artist", type: "address" }, { name: "lastValueUSDC", type: "uint256" },
    { name: "lastValueAt", type: "uint64" }, { name: "lockedAt", type: "uint64" }] },
  { type: "function", name: "estimatePositionValue", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [
    { name: "basketVal", type: "uint256" }, { name: "yieldVal", type: "uint256" }, { name: "total", type: "uint256" }] },
  { type: "function", name: "burnAndRedeem", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "op", type: "address" }, { name: "ok", type: "bool" }], outputs: [] },
  { type: "function", name: "isApprovedForAll", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "op", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "event", name: "Minted", inputs: [
    { name: "id", type: "uint256", indexed: true }, { name: "artist", type: "address", indexed: true }, { name: "escrowRef", type: "bytes32" }, { name: "valueUSDC", type: "uint256" }] },
  { type: "event", name: "BurnRequested", inputs: [
    { name: "id", type: "uint256", indexed: true }, { name: "escrowRef", type: "bytes32", indexed: true }, { name: "artist", type: "address", indexed: true }] },
  { type: "event", name: "ValueUpdated", inputs: [{ name: "id", type: "uint256", indexed: true }, { name: "newValueUSDC", type: "uint256" }] },
] as const;

/** NFTValuer (Polygon) — what the LendingPool reads for collateral value. */
export const nftValuerAbi = [
  { type: "function", name: "liveValue", stateMutability: "view", inputs: [{ name: "nft", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "modeOf", stateMutability: "view", inputs: [{ name: "nft", type: "address" }], outputs: [{ type: "uint8" }] },
] as const;

/** DiggerRegistry (Polygon) — collateral/listing eligibility. */
export const diggerRegistryAbi = [
  { type: "function", name: "isListable", stateMutability: "view", inputs: [{ name: "nft", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "isCollateral", stateMutability: "view", inputs: [{ name: "nft", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "collections", stateMutability: "view", inputs: [{ name: "nft", type: "address" }], outputs: [
    { name: "diggerId", type: "uint256" }, { name: "oracle", type: "address" }, { name: "maxLtvBps", type: "uint16" }, { name: "accepted", type: "bool" }] },
] as const;

/** LendingPool (Polygon) — borrow USDC against the mirror, repay. */
export const lendingPoolAbi = [
  { type: "function", name: "borrow", stateMutability: "nonpayable", inputs: [
    { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "borrowAmount", type: "uint256" }], outputs: [{ name: "loanId", type: "uint256" }] },
  { type: "function", name: "repay", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "activeLoanOf", stateMutability: "view", inputs: [{ name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [{ name: "loanId", type: "uint256" }] },
  { type: "function", name: "debtOf", stateMutability: "view", inputs: [{ name: "loanId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "loanHealthBps", stateMutability: "view", inputs: [{ name: "loanId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowAprBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/** BRMGMembership (Polygon) — tier from held+locked $BRMG. */
export const membershipAbi = [
  { type: "function", name: "tierOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint8" }] }, // 0 none,1 Bronze,2 Silver,3 Gold,4 Platinum
  { type: "function", name: "effectiveBalance", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "thresholds", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Phase 3 — Compliance / Graduation / Feeder / Secondary market  (Polygon 137)
// ─────────────────────────────────────────────────────────────────────────────

/** ComplianceRegistry (Polygon) — ERC-1404 source of truth for who may hold a
 *  BRMG security (Royalty Tokens + fan-pool mirror shares). Gate every screen
 *  where a user ACQUIRES one. `canHold` is the simple yes/no; `detect…` returns
 *  a restriction code (0 = ok) and `messageFor…` turns it into a human string. */
export const complianceRegistryAbi = [
  { type: "function", name: "canHold", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "detectTransferRestriction", stateMutability: "view", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "messageForTransferRestriction", stateMutability: "view", inputs: [{ name: "code", type: "uint8" }], outputs: [{ type: "string" }] },
  { type: "function", name: "requireAccreditation", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "status", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }, // bitmask: KYC|ACCREDITED|US_PERSON|FROZEN
] as const;

/** GraduationWarrant (Polygon) — soulbound ERC-721; a BR12 feeder work's
 *  contingent right. Read-only for the FE (status, streams, split, linked IP/RT). */
export const graduationWarrantAbi = [
  { type: "function", name: "getWarrant", stateMutability: "view", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [
    { name: "warrant", type: "tuple", components: [
      { name: "artist", type: "address" }, { name: "workId", type: "bytes32" },
      { name: "streamTarget", type: "uint64" }, { name: "cumulativeStreams", type: "uint64" },
      { name: "status", type: "uint8" }, { name: "graduatedAt", type: "uint64" },
      { name: "split", type: "tuple", components: [
        { name: "artistBps", type: "uint16" }, { name: "producerBps", type: "uint16" },
        { name: "brmgBps", type: "uint16" }, { name: "fanPoolBps", type: "uint16" }] },
      { name: "ipAsset", type: "address" }, { name: "rtToken", type: "address" }] }] },
  { type: "function", name: "statusOf", stateMutability: "view", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [{ type: "uint8" }] }, // 0 None,1 Active,2 Graduated,3 Cancelled
  { type: "function", name: "isGraduated", stateMutability: "view", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "artistOf", stateMutability: "view", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "nextId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "string" }] },
] as const;

/** FeederCampaign (Polygon) — fund-the-feeder: fans pledge USDC pre-graduation,
 *  then claim pro-rata fan-pool shares after the keeper funds the pool. */
export const feederCampaignAbi = [
  { type: "function", name: "pledge", stateMutability: "nonpayable", inputs: [{ name: "warrantId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "claimShares", stateMutability: "nonpayable", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [{ name: "shares", type: "uint256" }] },
  { type: "function", name: "refund", stateMutability: "nonpayable", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [] },
  { type: "function", name: "campaigns", stateMutability: "view", inputs: [{ name: "warrantId", type: "uint256" }], outputs: [
    { name: "exists", type: "bool" }, { name: "settled", type: "bool" }, { name: "deadline", type: "uint64" },
    { name: "artist", type: "address" }, { name: "totalRaised", type: "uint256" }, { name: "totalWeight", type: "uint256" },
    { name: "shareToken", type: "address" }, { name: "fanPoolShares", type: "uint256" }, { name: "sharesDistributed", type: "uint256" }] },
  { type: "function", name: "pledges", stateMutability: "view", inputs: [{ name: "warrantId", type: "uint256" }, { name: "fan", type: "address" }], outputs: [
    { name: "amount", type: "uint256" }, { name: "multiplierBps", type: "uint16" }, { name: "weight", type: "uint256" },
    { name: "sharesClaimed", type: "bool" }, { name: "refunded", type: "bool" }] },
  { type: "event", name: "Pledged", inputs: [
    { name: "warrantId", type: "uint256", indexed: true }, { name: "fan", type: "address", indexed: true }, { name: "amount", type: "uint256" }, { name: "newWeight", type: "uint256" }] },
] as const;

/** RoyaltyShareMarket (Polygon) — compliant secondary market for fan-pool shares.
 *  Maker `list`s shares priced in USDC; taker `fill`s partial/full (gated by the
 *  ComplianceRegistry on the taker). */
export const royaltyShareMarketAbi = [
  { type: "function", name: "list", stateMutability: "nonpayable", inputs: [
    { name: "shareToken", type: "address" }, { name: "payToken", type: "address" }, { name: "shareAmount", type: "uint256" }, { name: "askAmount", type: "uint256" }], outputs: [{ name: "orderId", type: "uint256" }] },
  { type: "function", name: "fill", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }, { name: "shareAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "cancel", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "orders", stateMutability: "view", inputs: [{ name: "orderId", type: "uint256" }], outputs: [
    { name: "maker", type: "address" }, { name: "shareToken", type: "address" }, { name: "payToken", type: "address" },
    { name: "shareAmount", type: "uint256" }, { name: "askAmount", type: "uint256" }, { name: "active", type: "bool" }] },
  { type: "function", name: "nextOrderId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "event", name: "Listed", inputs: [
    { name: "orderId", type: "uint256", indexed: true }, { name: "maker", type: "address", indexed: true }, { name: "shareToken", type: "address", indexed: true },
    { name: "payToken", type: "address" }, { name: "shareAmount", type: "uint256" }, { name: "askAmount", type: "uint256" }] },
  { type: "event", name: "Filled", inputs: [
    { name: "orderId", type: "uint256", indexed: true }, { name: "taker", type: "address", indexed: true }, { name: "shareAmount", type: "uint256" }, { name: "payAmount", type: "uint256" }, { name: "fee", type: "uint256" }] },
  { type: "event", name: "Cancelled", inputs: [{ name: "orderId", type: "uint256", indexed: true }, { name: "refundedShares", type: "uint256" }] },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Fan-pool RT bridge  (Story RoyaltyShareLocker ⇄ Polygon mirror factory/shares)
// ─────────────────────────────────────────────────────────────────────────────

/** RoyaltyShareLocker (Story) — a fan-pool RT slice is locked here; the keeper
 *  mirrors it on Polygon. Holder-callable: `lockShares`. KEEPER releases. */
export const royaltyShareLockerAbi = [
  { type: "function", name: "lockShares", stateMutability: "nonpayable", inputs: [
    { name: "ref", type: "bytes32" }, { name: "rtToken", type: "address" }, { name: "amount", type: "uint256" }, { name: "beneficiary", type: "address" }], outputs: [] },
  { type: "function", name: "lockedOf", stateMutability: "view", inputs: [{ name: "rtToken", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "locks", stateMutability: "view", inputs: [{ name: "ref", type: "bytes32" }], outputs: [
    { name: "rtToken", type: "address" }, { name: "amount", type: "uint256" }, { name: "beneficiary", type: "address" }, { name: "exists", type: "bool" }] },
  { type: "event", name: "SharesLocked", inputs: [
    { name: "ref", type: "bytes32", indexed: true }, { name: "rtToken", type: "address", indexed: true }, { name: "amount", type: "uint256" }, { name: "beneficiary", type: "address", indexed: true }] },
  { type: "event", name: "SharesReleased", inputs: [
    { name: "rtToken", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
] as const;

/** MirrorRoyaltyShareFactory (Polygon) — resolve a work's mirror by its RT. */
export const mirrorShareFactoryAbi = [
  { type: "function", name: "mirrorOf", stateMutability: "view", inputs: [{ name: "rtToken", type: "address" }], outputs: [{ type: "address" }] },
  { type: "event", name: "MirrorCreated", inputs: [
    { name: "rtToken", type: "address", indexed: true }, { name: "mirror", type: "address", indexed: true }, { name: "name", type: "string" }, { name: "symbol", type: "string" }] },
] as const;

/** MirrorRoyaltyShare (Polygon) — restricted 1:1 mirror ERC-20 of a fan-pool RT
 *  slice. ERC-20 + `burnAndRelease` (redeem the underlying RT back on Story; the
 *  keeper observes and releases). Holder↔holder transfers are compliance-gated. */
export const mirrorShareAbi = [
  ...erc20Abi,
  { type: "function", name: "burnAndRelease", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "storyRecipient", type: "address" }], outputs: [] },
  { type: "function", name: "rtToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "minted", stateMutability: "view", inputs: [{ name: "ref", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "operator", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "event", name: "BurnRequested", inputs: [
    { name: "from", type: "address", indexed: true }, { name: "amount", type: "uint256" }, { name: "storyRecipient", type: "address", indexed: true }] },
  { type: "event", name: "Minted", inputs: [
    { name: "ref", type: "bytes32", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
] as const;
