import { useEffect, useState } from "react";
import { ConnectButton } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { client } from "@/lib/thirdweb";
import { storyChain, polygonChain } from "@/config/brmg";

// thirdweb v5 EOA-first wallet structure:
//  • inAppWallet = email/Google/passkey → a thirdweb-managed EOA.
//  • Gasless lives ON the in-app wallet via `executionMode` (NOT the
//    `accountAbstraction` ConnectButton prop — that's EIP-4337 and wraps EVERY
//    wallet, incl. MetaMask, into a smart-contract account with a DIFFERENT address).
//  • EIP-7702 keeps the SAME EOA address and sponsors gas. thirdweb includes
//    1,000 sponsored txns free; Polygon gas is sub-cent. If a chain isn't 7702-
//    enabled for your client, swap to:
//      executionMode: { mode: "EIP4337", smartAccount: { chain: polygonChain, sponsorGas: true } }
export const WALLETS = [
  inAppWallet({
    auth: { options: ["email", "google", "passkey"] },
    executionMode: { mode: "EIP7702", sponsorGas: true },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

export function ConnectBar() {
  // thirdweb wallet UI is client-only; in TanStack Start / SSR, gate on mount so
  // the button never renders on the server (which is what trips the error boundary).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-28 animate-pulse rounded-md bg-card/60" />;

  return (
    <ConnectButton
      client={client}
      wallets={WALLETS}
      chains={[polygonChain, storyChain]}
      connectButton={{ label: "Connect" }}
      theme="dark"
    />
  );
}
