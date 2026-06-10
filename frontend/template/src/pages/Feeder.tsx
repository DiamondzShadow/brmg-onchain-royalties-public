import { useState } from "react";
import { prepareContractCall, toUnits } from "thirdweb";
import { useReadContract, useSendTransaction } from "thirdweb/react";
import { useBrmg } from "@/hooks/useBrmg";
import { ComplianceGate } from "@/components/ComplianceGate";
import { WARRANT_STATUS, RT_DECIMALS } from "@/config/brmg";

/**
 * Reference screen — read + write + compliance gate + keeper-async, all wired from
 * the shared config. The other screens (Catalog, Membership, Advances, Market)
 * follow the same shape: useBrmg() for contracts, useReadContract for reads (with
 * refetchInterval where a keeper flips state), prepareContractCall+useSendTransaction
 * for writes, ComplianceGate around any securities acquire.
 */
export default function Feeder({ warrantId }: { warrantId: bigint }) {
  const { graduationWarrant, feederCampaign, usdc } = useBrmg();
  const { mutate: sendTx, isPending } = useSendTransaction();
  const [amount, setAmount] = useState("100");

  const { data: warrant } = useReadContract({
    contract: graduationWarrant, method: "getWarrant", params: [warrantId],
  });
  const { data: campaign } = useReadContract({
    contract: feederCampaign, method: "campaigns", params: [warrantId],
    queryOptions: { refetchInterval: 20_000 }, // settle/fund happen via keeper
  });

  const status = warrant ? WARRANT_STATUS[Number(warrant.status)] : "…";
  const settled = campaign?.[1];
  const funded = campaign && campaign[7] > 0n;

  const pledge = () => {
    // USDC = 6 decimals (== RT_DECIMALS). approve, then pledge.
    const value = toUnits(amount, RT_DECIMALS);
    sendTx(prepareContractCall({ contract: usdc, method: "approve",
      params: [feederCampaign.address, value] }));
    sendTx(prepareContractCall({ contract: feederCampaign, method: "pledge",
      params: [warrantId, value] }));
  };

  const claim = () =>
    sendTx(prepareContractCall({ contract: feederCampaign, method: "claimShares",
      params: [warrantId] }));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Feeder #{String(warrantId)}</h2>
        <p className="text-sm text-muted-foreground">
          Status: {status}
          {warrant && ` · ${String(warrant.cumulativeStreams)}/${String(warrant.streamTarget)} streams`}
        </p>
      </header>

      {status !== "Graduated" ? (
        <ComplianceGate>
          <div className="flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)}
              className="rounded border bg-background px-3 py-2" />
            <button onClick={pledge} disabled={isPending}
              className="rounded bg-primary px-4 py-2 text-primary-foreground">
              Pledge USDC
            </button>
          </div>
        </ComplianceGate>
      ) : settled && funded ? (
        <ComplianceGate>
          <button onClick={claim} disabled={isPending}
            className="rounded bg-primary px-4 py-2 text-primary-foreground">
            Claim fan-pool shares
          </button>
        </ComplianceGate>
      ) : (
        <p className="text-sm text-muted-foreground">
          Graduated — waiting for the keeper to settle &amp; fund the fan pool…
        </p>
      )}
    </section>
  );
}
