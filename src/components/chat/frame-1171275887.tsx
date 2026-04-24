"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { NextPage } from "next";
import styles from "./frame-1171275887.module.css";
import { getGreeting, getSubheading } from "@/lib/greetings";
import { cn } from "@/lib/utils";

interface Frame117Props {
  firstName?: string | null;
}


const Frame1171275887: NextPage<Frame117Props> = ({ firstName }) => {
  const normalized = (() => {
    const trimmed = firstName?.trim();
    if (!trimmed) return "User";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  })();

  const [greeting, setGreeting] = useState("");
  const [subheading, setSubheading] = useState("");

  useEffect(() => {
    setGreeting(getGreeting(normalized));
    setSubheading(getSubheading());
  }, [normalized]);

  return (
    <div className={styles.frameParent}>
      <div className={styles.frameGroup}>
        <Image
          className={cn(styles.frameChild)}
          src="/new-logos/souvenir-logo-chat.svg"
          alt="Souvenir AI Chat"
          width={82}
          height={82}
          style={{ pointerEvents: "none" }}
          priority
        />
        <div className={styles.frameItem} />
      </div>
      <div className={styles.whatWouldYouLikeToExploreParent}>
        <div className={styles.whatWouldYou}>
          {greeting}
        </div>
        <div className={styles.yourIntelligentAssistant}>
          {subheading}
        </div>
      </div>
    </div>
  );
};

export default Frame1171275887;
