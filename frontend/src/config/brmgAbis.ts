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
