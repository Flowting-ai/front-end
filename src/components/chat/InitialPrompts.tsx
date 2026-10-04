"use client";

import { useState } from "react";
import { SouvenirLogo } from "@/components/SouvenirLogo";
import { getGreeting } from "@/lib/greetings";
import { useAuth } from "@/context/auth-context";
import { useMounted } from "@/hooks/use-mounted";

export function InitialPrompts({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const mounted = useMounted();
  const name = user?.firstName || user?.name || "there";

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        // Centred in both layouts (new chat landing and project/compare chats).
        alignItems:    "center",
        padding:       compact ? "0" : "0 24px",
        textAlign:     "center",
        maxWidth:      "860px",
        margin:        "0 auto",
        pointerEvents: "none",
        userSelect:    "none",
      }}
    >
      {mounted && <GreetingContent key={name} name={name} compact={compact} />}
    </div>
  );
}

function GreetingContent({ name, compact }: { name: string; compact: boolean }) {
  const [greeting] = useState(() => getGreeting(name));

  return (
    <>
      <h1
        style={{
          fontFamily: "var(--font-title)", // Google Sans
          fontSize:   compact ? "28px" : "34px",
          fontWeight: 400,
          color:      "var(--neutral-800)",
          margin:     0,
          lineHeight: 1.25,
          // Break a long greeting into two evenly-weighted lines, never one long line and an orphan word.
          textWrap:   "balance",
          // Hard stop at two lines: a greeting that still does not fit on a very narrow window is clipped
          // rather than growing a third line.
          maxHeight:  "2.5em",
          overflow:   "hidden",
        }}
      >
        <SouvenirLogo
          variant="gray"
          size={compact ? 26 : 34}
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            marginRight: "10px",
          }}
        />
        {greeting}
      </h1>
    </>
  );
}
