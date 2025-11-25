"use client";

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

  const formattedName = `${normalized}(username)`;

  return (
    <div className={styles.frameParent}>
      <div className={styles.frameGroup}>
        <Image
          className={styles.frameChild}
          src="/icons/logo.png"
          alt="FlowtingAi orb"
          width={142}
          height={133}
          priority
        />
        <div className={styles.frameItem} />
      </div>
      <div className={styles.whatWouldYouLikeToExploreParent}>
        <div className={styles.whatWouldYou}>
          What would you like to explore today?
          <br />
          {formattedName}
        </div>
        <div className={styles.yourIntelligentAssistant}>
          Your intelligent assistant for reports, automation, and creative
          workflows.
        </div>
      </div>
    </div>
  );
};

export default Frame1171275887;
