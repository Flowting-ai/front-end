"use client";

import { useState } from "react";
import Image from 'next/image';
import { getGreeting, getSubheading } from "@/lib/greetings";
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
        alignItems:    compact ? "flex-start" : "center",
        padding:       compact ? "0" : "0 24px",
        textAlign:     compact ? "left" : "center",
        maxWidth:      "640px",
        margin:        compact ? "0" : "0 auto",
        pointerEvents: "none",
        userSelect:    "none",
      }}
    >
      {mounted && <GreetingContent key={name} name={name} compact={compact} />}
    </div>
  );
}

function GreetingContent({ name, compact }: { name: string; compact: boolean }) {
  const [{ greeting, subheading }] = useState(() => ({
    greeting: getGreeting(name),
    subheading: getSubheading(),
  }));

  return (
    <>
      <h1
        style={{
          fontFamily: compact ? "var(--font-body)" : "var(--font-title)",
          fontSize:   compact ? "24px" : "28px",
          fontWeight: compact ? 500 : 200,
          color:      "var(--neutral-800)",
          margin:     "0 0 6px",
          lineHeight: 1.25,
        }}
      >
        <Image
          src="/icons/souvenir-logo-gray.svg"
          alt=""
          aria-hidden="true"
          width={compact ? 22 : 28}
          height={compact ? 22 : 28}
          unoptimized
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            marginRight: "10px",
          }}
        />
        {greeting}
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize:   compact ? "13px" : "16px",
          fontWeight: 400,
          color:      compact ? "var(--color-text-muted)" : "#3B3632",
          margin:     "0",
          lineHeight: 1.5,
          maxWidth:   "480px",
        }}
      >
        {subheading}
      </p>
    </>
  );
}
