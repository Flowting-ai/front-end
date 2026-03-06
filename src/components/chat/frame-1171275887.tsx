"use client";

import Image from "next/image";
import type { NextPage } from "next";
import styles from "./frame-1171275887.module.css";

interface Frame117Props {
  firstName?: string | null;
}

const Frame1171275887: NextPage<Frame117Props> = ({ firstName }) => {
  const normalized = (() => {
    const trimmed = firstName?.trim();
    if (!trimmed) return "User";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  })();

  const formattedName = `${normalized}?`;

  return (
    <div className={styles.frameParent}>
      <div className={styles.frameGroup}>
        <Image
          className={styles.frameChild}
          src="/new-logos/souvenir-logo-chat.svg"
          alt="Souvenir AI Chat"
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
