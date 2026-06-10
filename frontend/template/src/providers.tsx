import { ThirdwebProvider } from "thirdweb/react";
import type { PropsWithChildren } from "react";

// thirdweb v5 ships its own QueryClient internally; ThirdwebProvider is all you need.
export function AppProviders({ children }: PropsWithChildren) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
