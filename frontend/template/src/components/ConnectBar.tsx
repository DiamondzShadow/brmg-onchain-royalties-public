import { ConnectButton } from "thirdweb/react";
import { client } from "@/lib/thirdweb";
import { storyChain, polygonChain } from "@/config/brmg";

export function ConnectBar() {
  return (
    <ConnectButton
      client={client}
      chains={[polygonChain, storyChain]}
      connectButton={{ label: "Connect" }}
      theme="dark"
    />
  );
}
