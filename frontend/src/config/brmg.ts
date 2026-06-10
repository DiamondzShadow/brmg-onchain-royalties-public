/**
 * BRMG dApp config — chains, addresses, the works registry, and thirdweb v5
 * contract helpers. Drop into a Lovable / thirdweb-v5 app.
 *
 * ── Two-chain, keeper-mediated model (read before building) ───────────────────
 * • Royalty Tokens, revenue, the advance ESCROW, and the fan-pool LOCKER live on
 *   **Story (1514)**.
 * • $BRMG, membership, the advance/fan-pool MIRRORS, lending, and the whole fan
 *   economy (graduation / feeder / compliance / secondary market) live on
 *   **Polygon (137)**.
 * • Cross-chain steps are ASYNC and handled by an off-chain keeper, NOT the UI:
 *     advance:   lock RT on Story  → (keeper) mint advance mirror NFT on Polygon;
 *                burn mirror Poly  → (keeper) release the Story escrow.
 *     fan-pool:  lock RT slice on Story (RoyaltyShareLocker) → (keeper) mint the
 *                MirrorRoyaltyShare ERC-20 on Polygon + fundFanPool; a fan
 *                `burnAndRelease`s the mirror → (keeper) releases RT on Story.
 *   The UI triggers the user-side tx, then POLLS for the keeper's result
 *   (typically minutes). Never call mintMirror / releaseEscrow / releaseShares /
 *   fundFanPool from the client — those are keeper-only (MESSENGER/KEEPER_ROLE).
 * • CLAIMING revenue: use the Story TS SDK (`@story-protocol/core-sdk`
 *   `client.royalty.claimAllRevenue`) or the Story API — it resolves royalty
 *   policy + currency for you. Hand-rolling RoyaltyWorkflows is not worth it.
 * • SECURITIES vs UTILITY — keep firewalled:
 *     securities (GATE on ComplianceRegistry.canHold before any acquire): Royalty
 *       Tokens, fan-pool mirror shares, RoyaltyShareMarket, FeederCampaign.claimShares.
 *     utility (open): $BRMG, membership, graduation warrant reads, pledging USDC.
 * • Per-work mirror address is dynamic: read mirrorShareFactory.mirrorOf(rtToken)
 *   (returns 0x0 until the first bridge for that RT creates it).
 */
import { defineChain } from "thirdweb/chains";
import { getContract, type ThirdwebClient } from "thirdweb";
import {
  erc20Abi, wipAbi, royaltyModuleAbi, royaltyEscrowAbi, royaltyAdvanceWrapperAbi,
  nftValuerAbi, diggerRegistryAbi, lendingPoolAbi, membershipAbi,
  complianceRegistryAbi, graduationWarrantAbi, feederCampaignAbi, royaltyShareMarketAbi,
  royaltyShareLockerAbi, mirrorShareFactoryAbi, mirrorShareAbi,
} from "./brmgAbis";

// ── Chains ───────────────────────────────────────────────────────────────────
// Story is not a built-in thirdweb chain — define it. Polygon/Arbitrum are built-in.
export const storyChain = defineChain({
  id: 1514,
  name: "Story",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpc: "https://mainnet.storyrpc.io",
  blockExplorers: [{ name: "Storyscan", url: "https://www.storyscan.io" }],
});
export const polygonChain = defineChain(137);
export const arbitrumChain = defineChain(42161);

// ── Addresses ──────────────────────────────────────────────────────────────
export const ADDR = {
  story: {
    royaltyModule: "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086",
    wip: "0x1514000000000000000000000000000000000000", // wrapped IP (revenue currency)
    spgCollection: "0x020CE1b10Ce744Fc876633fD4B8b3b06fC426c76", // BRMG catalog
    royaltyEscrow: "0x85d9d5c771fe63a27f8cf426b9f894fc028e8bee", // Phase 2 advance escrow
    royaltyShareLocker: "0xa6620fbe90ad0a363fc7bb3d4e939a74acaefdf6", // fan-pool RT bridge (Story leg)
  },
  polygon: {
    brmgToken: "0x1f92cdCfd3c172dD8b40287188dEC7331059575C",
    brmgMembership: "0x17CE1bD3028CB5Faeb10E50be4eD63bAe285D7af",
    brmgSink: "0x266fd19e371dDf3D1eA471b97dd6A2A296B8c3f9",
    brmgSignal: "0xb0F0aE6c5f43709d7930fb16Ff07235846034fFa",
    royaltyAdvanceWrapper: "0xffd7096Ee8403D240a3DBE01Df57477cA9393571", // Phase 2 mirror (advance)
    diggerRegistry: "0x151c4752A875dc5CE40A466bc85F85Ece6756e86",
    nftValuer: "0xD6F819B0Ea9091988D38D937fC6745E142990Ba8",
    lendingPool: "0x2e5b111447a93ca2b900e9da96822344d6Be49eC",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // native USDC
    // Phase 3 — feeder / graduation / compliance / secondary market
    complianceRegistry: "0x98244380a060A2a0D4EB3a138517a5b5F9cC183d",
    graduationWarrant: "0xF5F3728724aDcd13D3a16adB9c85e522FBb3948f",
    feederCampaign: "0x549eBbcC16Fac38C3A5e6439921ab64a5285d276",
    royaltyShareMarket: "0x1724e392a5D7Da23B883277cE9cB8578F5196763",
    // Fan-pool RT bridge (Polygon leg): factory → one MirrorRoyaltyShare per RT
    mirrorShareFactory: "0x3cF453855f491c7Fce8Da6DEAB8CB76C47e74137",
  },
} as const;

// ── Works registry (seed; index more on-chain or in Supabase) ─────────────────
// One entry per registered work. `royaltyToken` is the per-IP RT vault (ERC-20).
export interface BrmgWork {
  key: string;
  title: string;
  ipAsset: `0x${string}`;
  royaltyToken: `0x${string}`;
  pilTermsId: number;
  splits: { role: string; recipient: `0x${string}`; pct: number }[];
}
export const WORKS: BrmgWork[] = [
  {
    key: "brmg-r-0001",
    title: "Billionaires Row — Genesis",
    ipAsset: "0xb2779bf818f9C5e8A35c9ee6b2a5FC2B45401D2b",
    royaltyToken: "0x5361cB2A1FE33a22358b577c38916b6D3323469B",
    pilTermsId: 28725,
    splits: [
      { role: "artist", recipient: "0x3D56B28516282143B347BE5A1de4301d5A91fc9d", pct: 70 },
      { role: "producer", recipient: "0xC5D133296E17BA25DF0409a6C31607bf3B78e3e3", pct: 10 },
      { role: "fan_pool", recipient: "0xdF46A5083C01C82b2e70fF97E9cf27fC80000851", pct: 20 },
    ],
  },
];

// ── Constants ────────────────────────────────────────────────────────────────
export const RT_DECIMALS = 6; // Royalty Token + USDC
export const RT_TOTAL_SUPPLY = 100_000_000; // every work mints 100M RT
export const WIP_DECIMALS = 18;
export const ADVANCE_LTV_BPS = 1500; // 15% conservative LTV
export const MESSENGER_ROLE = "0x9169014801faeffeb0ffa6d3da58be378861e512c765e75a348579eecb031854";

export const BRMG_TOKENOMICS = {
  cap: 1_000_000_000,
  genesisMinted: 200_000_000, // 20% to the treasury Safe; 80% reserved, multisig-minted
  decimals: 18,
  treasurySafe: "0xdF46A5083C01C82b2e70fF97E9cf27fC80000851",
} as const;

export const MEMBERSHIP_TIERS = ["None", "Bronze", "Silver", "Gold", "Platinum"] as const; // index = tierOf()
export const WARRANT_STATUS = ["None", "Active", "Graduated", "Cancelled"] as const; // index = statusOf()

// ComplianceRegistry.status() bitmask — a holder must be KYC'd (and ACCREDITED
// when requireAccreditation() is on) and not FROZEN to acquire a BRMG security.
export const COMPLIANCE_FLAGS = { KYC: 1, ACCREDITED: 2, US_PERSON: 4, FROZEN: 8 } as const;

// derive the Polygon mirror tokenId for a Story escrowRef (tokenId == uint256(escrowRef))
export const mirrorTokenId = (escrowRef: `0x${string}`): bigint => BigInt(escrowRef);

// deterministic fan-pool bridge ref the keeper expects: keccak(abi.encode(warrantId, rtToken)).
// (Compute with viem `keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'}], [id, rt]))`.)

// explorer links
export const explorer = {
  storyIp: (ipId: string) => `https://explorer.story.foundation/ipa/${ipId}`,
  storyTx: (h: string) => `https://www.storyscan.io/tx/${h}`,
  polygonAddr: (a: string) => `https://polygonscan.com/address/${a}`,
  polygonTx: (h: string) => `https://polygonscan.com/tx/${h}`,
};

// ── thirdweb contract helpers ────────────────────────────────────────────────
// Pass your thirdweb client once; get typed contracts on the right chain.
export const brmgContracts = (client: ThirdwebClient) => ({
  // Story
  royaltyModule: getContract({ client, chain: storyChain, address: ADDR.story.royaltyModule, abi: royaltyModuleAbi }),
  wip: getContract({ client, chain: storyChain, address: ADDR.story.wip, abi: wipAbi }),
  royaltyEscrow: getContract({ client, chain: storyChain, address: ADDR.story.royaltyEscrow, abi: royaltyEscrowAbi }),
  royaltyToken: (addr: string) => getContract({ client, chain: storyChain, address: addr, abi: erc20Abi }),
  royaltyShareLocker: getContract({ client, chain: storyChain, address: ADDR.story.royaltyShareLocker, abi: royaltyShareLockerAbi }),
  // Polygon
  brmgToken: getContract({ client, chain: polygonChain, address: ADDR.polygon.brmgToken, abi: erc20Abi }),
  membership: getContract({ client, chain: polygonChain, address: ADDR.polygon.brmgMembership, abi: membershipAbi }),
  advanceWrapper: getContract({ client, chain: polygonChain, address: ADDR.polygon.royaltyAdvanceWrapper, abi: royaltyAdvanceWrapperAbi }),
  nftValuer: getContract({ client, chain: polygonChain, address: ADDR.polygon.nftValuer, abi: nftValuerAbi }),
  diggerRegistry: getContract({ client, chain: polygonChain, address: ADDR.polygon.diggerRegistry, abi: diggerRegistryAbi }),
  lendingPool: getContract({ client, chain: polygonChain, address: ADDR.polygon.lendingPool, abi: lendingPoolAbi }),
  usdc: getContract({ client, chain: polygonChain, address: ADDR.polygon.usdc, abi: erc20Abi }),
  // Phase 3 — securities + fan economy (Polygon)
  compliance: getContract({ client, chain: polygonChain, address: ADDR.polygon.complianceRegistry, abi: complianceRegistryAbi }),
  graduationWarrant: getContract({ client, chain: polygonChain, address: ADDR.polygon.graduationWarrant, abi: graduationWarrantAbi }),
  feederCampaign: getContract({ client, chain: polygonChain, address: ADDR.polygon.feederCampaign, abi: feederCampaignAbi }),
  shareMarket: getContract({ client, chain: polygonChain, address: ADDR.polygon.royaltyShareMarket, abi: royaltyShareMarketAbi }),
  mirrorShareFactory: getContract({ client, chain: polygonChain, address: ADDR.polygon.mirrorShareFactory, abi: mirrorShareFactoryAbi }),
  // per-RT fan-pool mirror ERC-20 (resolve its address via mirrorShareFactory.mirrorOf(rt))
  mirrorShare: (addr: string) => getContract({ client, chain: polygonChain, address: addr, abi: mirrorShareAbi }),
});

export * from "./brmgAbis";
