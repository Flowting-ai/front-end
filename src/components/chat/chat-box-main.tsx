
"use client";

import Image from "next/image";
import type { NextPage } from "next";
import { ChevronDown, Mic } from "lucide-react";
import styles from "./chat-box-main.module.css";

const ChatBoxMain: NextPage = () => {
  return (
    <div className={styles.chatBoxMain}>
      <div className={styles.placeholder}>Lets Play.....</div>
      <div className={styles.frameParent}>
        <div className={styles.iconButtonParent}>
          <button className={styles.iconButton} type="button">
            <Image
              className={styles.iconWrapper}
              src="/icons/chatboard.svg"
              alt="Library"
              width={16}
              height={16}
            />
          </button>
          <div className={styles.textMessageLeft}>
            <div className={styles.button}>
              <Image
                src="/icons/chatboard.svg"
                alt="Library"
                width={16}
                height={16}
              />
              <span>Library</span>
            </div>
            <div className={styles.selectCombobox}>
              <div className={styles.selectLeftDecoration}>
                <Image
                  src="/icons/logo.png"
                  alt="Persona"
                  width={20}
                  height={20}
                />
              </div>
              <span className={styles.selectAnItem}>Choose Persona</span>
              <div className={styles.selectComboboxRightDecora}>
                <ChevronDown size={16} />
              </div>
            </div>
            <div className={styles.buttonSecondary}>
              <span>Add Context</span>
            </div>
          </div>
        </div>
        <div className={styles.badgeParent}>
          <div className={styles.badge}>
            <div className={styles.label}>80% used</div>
          </div>
          <div className={styles.divider} />
          <button className={styles.iconButtonDark} type="button">
            <span className={styles.iconMicWrapper}>
              <Mic size={20} color="#fff" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBoxMain;