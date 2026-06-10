import type { PropsWithChildren } from "react";
import { useCompliance } from "@/hooks/useBrmg";

/** Wrap any securities "acquire" action (claimShares, market fill, RT transfer). */
export function ComplianceGate({ children }: PropsWithChildren) {
  const { eligible, isLoading, connected } = useCompliance();
  if (!connected) return <p className="text-sm text-muted-foreground">Connect a wallet to continue.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Checking eligibility…</p>;
  if (!eligible)
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="font-medium text-amber-300">KYC required</p>
        <p className="text-muted-foreground">
          Royalty-bearing shares are restricted securities. Complete KYC to hold them.
        </p>
      </div>
    );
  return <>{children}</>;
}
