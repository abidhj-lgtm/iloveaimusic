"use client";

import React from "react";
import { StoreProvider } from "@/lib/store";
import { PlayerProvider } from "@/lib/player";
import { AppShell } from "./layout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <PlayerProvider>
        <AppShell>{children}</AppShell>
      </PlayerProvider>
    </StoreProvider>
  );
}