import { useReadContract } from "thirdweb/react";
import { useBrmg } from "./useBrmg";

/**
 * Keeper-async pattern. After a user locks a fan-pool RT slice on Story, the
 * off-chain keeper mints the mirror on Polygon (minutes later). Poll
 * mirrorOf(rtToken) until it appears. Use the returned `pending` to drive a
 * "bridging…" state; `mirror` is the live ERC-20 address once minted.
 *
 * The same shape applies to any keeper-mediated step — point useReadContract at
 * the state the keeper flips (campaign.fanPoolShares, advanceWrapper.ownerOf,
 * escrow.positions[].status) with a refetchInterval and render the in-between.
 */
export function useMirrorForRt(rtToken: `0x${string}`) {
  const { mirrorShareFactory } = useBrmg();
  const { data: mirror } = useReadContract({
    contract: mirrorShareFactory,
    method: "mirrorOf",
    params: [rtToken],
    queryOptions: { refetchInterval: 15_000 }, // poll while the keeper works
  });
  const exists = !!mirror && mirror !== "0x0000000000000000000000000000000000000000";
  return { mirror: exists ? (mirror as `0x${string}`) : undefined, pending: !exists };
}
