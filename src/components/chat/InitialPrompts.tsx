"use client";

import { Fragment, useState } from "react";
import { SouvenirLogo } from "@/components/SouvenirLogo";
import { fillGreeting, pickGreeting, splitGreeting } from "@/lib/greetings";
import styles from "./InitialPrompts.module.css";
import { useAuth } from "@/context/auth-context";
import { useMounted } from "@/hooks/use-mounted";

export function InitialPrompts({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const mounted = useMounted();
  // No name → the greeting drops it ("Where were we?"); see fillGreeting.
  const name = user?.firstName || user?.name || "";

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
      {mounted && <GreetingContent name={name} compact={compact} />}
    </div>
  );
}

function GreetingContent({ name, compact }: { name: string; compact: boolean }) {
  // Pick the greeting once per landing and fill the name in on each render: when the profile arrives
  // after first paint, the name just slots into the same greeting instead of remounting it (which would
  // swap the line and restart the logo's arrival).
  const [template] = useState(() => pickGreeting());

  return <GreetingHeading greeting={fillGreeting(template, name)} compact={compact} animateLogo />;
}

// An unbreakable unit: the line can wrap around it, but only wraps inside it if it alone is wider than
// the line (a very narrow screen).
const UNIT: React.CSSProperties = { display: "inline-block" };

/**
 * The greeting heading on its own, also rendered by the /dev/greetings preview. `animateLogo` plays the
 * mark's one-time arrival (InitialPrompts.module.css) when the heading mounts.
 */
export function GreetingHeading({ greeting, compact, animateLogo = false }: {
  greeting: string;
  compact: boolean;
  animateLogo?: boolean;
}) {
  const logoSize = compact ? 26 : 34;

  // One line when it fits. When it doesn't, it breaks only between the two halves from splitGreeting —
  // whole sentences per line — and each half only between its sentences. The mark sits inline at the
  // start of the first sentence so it always travels with the first line instead of being stranded.
  return (
    <h1
      style={{
        fontFamily: "var(--font-title)", // Google Sans
        fontSize:   compact ? "28px" : "34px",
        fontWeight: 400,
        color:      "var(--neutral-800)",
        margin:     0,
        lineHeight: 1.25,
        textAlign:  "center",
        textWrap:   "balance",
      }}
    >
      {splitGreeting(greeting).map((sentences, half) => (
        <Fragment key={half}>
          {half > 0 && " "}
          <span style={UNIT}>
            {sentences.map((sentence, i) => (
              <Fragment key={i}>
                {i > 0 && " "}
                <span style={UNIT}>
                  {half === 0 && i === 0 && (
                    <SouvenirLogo
                      variant="gray"
                      size={logoSize}
                      className={animateLogo ? styles.orbit : undefined}
                      style={{
                        display:       "inline-block",
                        // Centre the mark on the capitals (Google Sans cap height ≈ 0.72em), not the x-height.
                        verticalAlign: `calc(0.36em - ${logoSize / 2}px)`,
                        marginRight:   compact ? "10px" : "12px",
                      }}
                    />
                  )}
                  {sentence}
                </span>
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </h1>
  );
}
