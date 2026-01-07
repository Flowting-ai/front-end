"use client";
// Purpose: Branded hero/empty-state block shown above initial prompts.
// Usage: Imported by initial prompts and rendered by `ChatInterface` when there are no messages.
// Keep: This is actively used. Only remove if replacing the initial prompts UX.
// Where used: see `src/components/chat/initial-prompts.tsx` and `src/components/chat/chat-interface.tsx`.

import Image from "next/image";
import type { NextPage } from "next";
import styles from "./frame-1171275887.module.css";

interface Frame117Props {
  userName?: string | null;
}

const Frame1171275887: NextPage<Frame117Props> = ({ userName }) => {
  const normalized = (() => {
    if (!userName?.trim()) return "Jack";
    const clean = userName.includes("@")
      ? userName.split("@")[0]
      : userName.split(" ")[0];
    if (!clean) return "Jack";
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  })();

  const formattedName = `${normalized}?`;

  return (
    <div className={styles.frameParent}>
      <div className={styles.frameGroup}>
        <Image
          className={styles.frameChild}
          src="/icons/FlowtingAI_LightGrey.png"
          alt="FlowtingAi orb"
          width={82}
          height={82}
          priority
        />
        <div className={styles.frameItem} />
      </div>
      <div className={styles.whatWouldYouLikeToExploreParent}>
        <div className={styles.whatWouldYou}>
          What would you like to explore today,
          <br />
          {formattedName}
        </div>
        <div className={styles.yourIntelligentAssistant}>
          Work smarter with pinned insights, tailored personas, and model-to-model conversations
        </div>
      </div>
    </div>
  );
};

export default Frame1171275887;
