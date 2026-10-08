"use client";

import React from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { PenOneIcon, DeleteTwoIcon } from "@strange-huge/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";
import { PINS_ENABLED } from "@/lib/feature-flags";
import type { QueuedMessage } from "@/lib/message-queue";

/** How a row leaves: `sent` lifts off toward the thread, where the real
 *  message lands; `dismissed` (edited, removed, put back) just fades. */
export type QueuedRowExit = "sent" | "dismissed";

interface QueuedMessagesTrayProps {
  messages: readonly QueuedMessage[];
  /** What the queue is waiting for, after "Queued ·". */
  status: string;
  /** Waiting on a reply that is running: the status shimmers. */
  waiting: boolean;
  /** How the row that leaves next goes — see QueuedRowExit. */
  rowExit: QueuedRowExit;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

// The tray tucks this far under the composer, so it reads as sliding out from
// behind the box rather than floating above it.
const TUCK = 18;
const ROW_HEIGHT = 36;
// Rows shown before the list scrolls (a half row peeks to show there's more).
const VISIBLE_ROWS = 3.5;

const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

const LIFT_OFF = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const;

const ROW_VARIANTS = {
  exit: (kind: QueuedRowExit = "dismissed") => kind === "sent"
    ? { opacity: 0, y: -16, scale: 0.97, filter: "blur(2px)", transition: LIFT_OFF }
    : { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

// When the last message leaves, the tray goes with it: lifting off after a
// send, sliding back under the composer otherwise.
const TRAY_VARIANTS = {
  exit: (kind: QueuedRowExit = "dismissed") => kind === "sent"
    ? { opacity: 0, y: -12, filter: "blur(2px)", transition: LIFT_OFF }
    : { opacity: 0, y: TUCK, transition: { duration: 0.18 } },
};

/**
 * The messages the user queued while a reply runs, stacked just above the
 * composer in send order. Each can be edited (back into the box) or removed;
 * the next one lifts off toward the thread as it's sent.
 */
export function QueuedMessagesTray({ messages, status, waiting, rowExit, onEdit, onRemove }: QueuedMessagesTrayProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} custom={rowExit}>
      {messages.length > 0 && (
        <m.div
          key="queued-tray"
          role="region"
          aria-label="Queued messages"
          variants={reduceMotion ? undefined : TRAY_VARIANTS}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: TUCK }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={reduceMotion ? { opacity: 0 } : "exit"}
          transition={reduceMotion ? { duration: 0.15 } : SPRING}
          style={{
            position:        "relative",
            zIndex:          0,
            margin:          `0 12px -${TUCK}px`,
            padding:         `8px 8px ${TUCK + 6}px`,
            borderRadius:    "16px 16px 0 0",
            backgroundColor: "var(--neutral-100)",
            boxShadow:       "inset 0 0 0 1px var(--neutral-200)",
          }}
        >
          {/* Header: what the queue is waiting for. */}
          <div
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        6,
              padding:    "2px 8px 6px",
              color:      "var(--neutral-500)",
            }}
          >
            <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>
              <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.5} />
            </span>
            <span
              className={waiting ? "kaya-shimmer" : undefined}
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)",
                fontSize:   "var(--font-size-caption)",
                lineHeight: "var(--line-height-caption)",
                minWidth:   0,
                overflow:   "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {messages.length > 1 ? `${messages.length} queued` : "Queued"} · {status}
            </span>
          </div>

          {/* Rows, oldest (next to send) first. */}
          <m.ol
            layout={!reduceMotion}
            className="kaya-scrollbar"
            style={{
              position:  "relative",
              listStyle: "none",
              margin:    0,
              padding:   0,
              display:   "flex",
              flexDirection: "column",
              gap:       2,
              maxHeight: ROW_HEIGHT * VISIBLE_ROWS,
              overflowY: "auto",
            }}
          >
            <AnimatePresence initial={false} mode="popLayout" custom={rowExit}>
              {messages.map((message, index) => (
                <QueuedRow
                  key={message.id}
                  message={message}
                  position={index + 1}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  reduceMotion={!!reduceMotion}
                />
              ))}
            </AnimatePresence>
          </m.ol>
        </m.div>
      )}
    </AnimatePresence>
  );
}

interface QueuedRowProps {
  message: QueuedMessage;
  position: number;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  reduceMotion: boolean;
  ref?: React.Ref<HTMLLIElement>;
}

function QueuedRow({ message, position, onEdit, onRemove, reduceMotion, ref }: QueuedRowProps) {
  const fileCount = message.attachments.length;
  const pinCount = PINS_ENABLED ? message.mentionedPins.length : 0;
  // A message of only files or pins still needs a line to show.
  const text = message.content
    || (fileCount > 0 ? message.attachments.map((a) => a.file.name).join(", ") : "")
    || message.mentionedPins.map((p) => `@${p.label}`).join(", ");

  return (
    <m.li
      ref={ref}
      layout={!reduceMotion}
      variants={ROW_VARIANTS}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      exit="exit"
      transition={reduceMotion ? { duration: 0.15 } : SPRING}
      aria-label={`Queued message ${position}`}
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             8,
        minHeight:       ROW_HEIGHT,
        padding:         "0 4px 0 10px",
        borderRadius:    10,
        backgroundColor: "var(--chat-input-bg)",
        boxShadow:       "0 0 0 1px var(--neutral-200)",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          minWidth:   14,
          fontFamily: "var(--font-body)",
          fontSize:   "var(--font-size-caption)",
          fontWeight: "var(--font-weight-medium)",
          color:      "var(--neutral-400)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {position}
      </span>
      <span
        title={message.content || undefined}
        style={{
          flex:         "1 1 auto",
          minWidth:     0,
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
          fontFamily:   "var(--font-body)",
          fontSize:     "var(--font-size-body)",
          lineHeight:   "var(--line-height-body)",
          color:        "var(--neutral-800)",
        }}
      >
        {text}
      </span>
      {(fileCount > 0 || pinCount > 0) && (
        <span
          style={{
            flexShrink: 0,
            fontFamily: "var(--font-body)",
            fontSize:   "var(--font-size-caption)",
            color:      "var(--neutral-500)",
            whiteSpace: "nowrap",
          }}
        >
          {[
            fileCount > 0 ? `${fileCount} file${fileCount === 1 ? "" : "s"}` : null,
            pinCount > 0 ? `${pinCount} pin${pinCount === 1 ? "" : "s"}` : null,
          ].filter(Boolean).join(" · ")}
        </span>
      )}
      <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <Tooltip content="Edit" side="top">
          <IconButton
            variant="ghost-2"
            size="xs"
            aria-label={`Edit queued message ${position}`}
            icon={<span style={{ display: "flex", color: "var(--message-bubble-action-icon)" }}><PenOneIcon size={16} /></span>}
            onClick={() => onEdit(message.id)}
          />
        </Tooltip>
        <Tooltip content="Remove" side="top">
          <IconButton
            variant="ghost-2"
            size="xs"
            aria-label={`Remove queued message ${position}`}
            icon={<span style={{ display: "flex", color: "var(--message-bubble-action-icon)" }}><DeleteTwoIcon size={16} /></span>}
            onClick={() => onRemove(message.id)}
          />
        </Tooltip>
      </span>
    </m.li>
  );
}
