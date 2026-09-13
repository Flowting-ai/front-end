"use client";

import { createContext, use } from "react";
import {
  useBrainThreads as useBrainThreadsHook,
  type UseBrainThreadsResult,
} from "@/hooks/use-brain-threads";

const BrainThreadContext = createContext<UseBrainThreadsResult | null>(null);

export function BrainThreadProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const brainThreads = useBrainThreadsHook();
  return (
    <BrainThreadContext.Provider value={brainThreads}>
      {children}
    </BrainThreadContext.Provider>
  );
}

export function useBrainThreadContext(): UseBrainThreadsResult {
  const ctx = use(BrainThreadContext);
  if (!ctx) {
    throw new Error(
      "useBrainThreadContext must be used within BrainThreadProvider",
    );
  }
  return ctx;
}
