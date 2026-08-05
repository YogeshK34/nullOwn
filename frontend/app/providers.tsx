"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, type State } from "wagmi";

import { getConfig } from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

type ProvidersProps = {
  children: ReactNode;
  /** Hydrated from the request cookie by the root layout. */
  initialState: State | undefined;
};

/**
 * Client-side provider stack. Both the wagmi config and the query client are
 * created inside `useState` initialisers so each browser session gets exactly
 * one instance that survives re-renders but is never shared across requests.
 *
 * RainbowKit is themed to match the existing surface — near-black panels, amber
 * accent, square corners (`--radius: 0px`) — so the wallet modal does not read
 * as a bolted-on third-party widget.
 */
export function Providers({ children, initialState }: ProvidersProps) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain reads are cheap to repeat but jarring to see flicker.
            staleTime: 10_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#f59e0b",
            accentColorForeground: "#18181b",
            borderRadius: "none",
            fontStack: "system",
            overlayBlur: "small",
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
