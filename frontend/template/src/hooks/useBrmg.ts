import { useMemo } from "react";
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb";
import { brmgContracts, WORKS } from "@/config/brmg";

/** Typed contracts on the right chain, memoized. */
export function useBrmg() {
  return useMemo(() => brmgContracts(client), []);
}

export function useWorks() {
  return WORKS;
}

/**
 * Compliance gate for BRMG securities (Royalty Tokens + fan-pool mirror shares).
 * Call before rendering any "acquire" action; show <ComplianceGate> when !eligible.
 */
export function useCompliance() {
  const account = useActiveAccount();
  const { compliance } = useBrmg();
  const { data: eligible, isLoading } = useReadContract({
    contract: compliance,
    method: "canHold",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
    queryOptions: { enabled: !!account },
  });
  return { eligible: !!eligible, isLoading, connected: !!account };
}
