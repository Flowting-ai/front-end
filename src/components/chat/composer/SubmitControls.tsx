"use client";

import React, { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  ArrowUpTwoIcon,
  MicTwoIcon,
  StopCircleIcon,
} from "@strange-huge/icons";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { AudioWaveDisplay } from "@/components/shared/AudioWaveDisplay";

interface SubmitControlsProps {
  value: string;
  hasAttachments: boolean;
  isStreaming: boolean;
  isRecording: boolean;
  analyser: AnalyserNode | null;
  sendBlocked: boolean;
  sendWhenReady: boolean;
  sendQueues: boolean;
  disabled: boolean;
  /** The action button can't be used (see ChatInput's isActionDisabled). */
  actionDisabled: boolean;
  showQueueButton: boolean;
  /** Stop stream / stop recording / send / start recording. */
  onAction: () => void;
  onQueue: () => void;
}

/**
 * The trailing action button — Stop while a reply streams, Send once there's
 * something to send, otherwise voice input — and the Queue button that slides
 * in beside Stop.
 */
export function SubmitControls({
  value,
  hasAttachments,
  isStreaming,
  isRecording,
  analyser,
  sendBlocked,
  sendWhenReady,
  sendQueues,
  disabled,
  actionDisabled,
  showQueueButton,
  onAction,
  onQueue,
}: SubmitControlsProps) {
  const [isMicHovered,  setIsMicHovered]  = useState(false);
  const [isQueueHovered, setIsQueueHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  // Derive a stable string key for the AnimatePresence icon swap
  const iconKey = isStreaming
    ? "stream-stop"
    : isRecording
      ? isMicHovered
        ? "rec-stop"
        : "wave"
      : value || hasAttachments
        ? "send"
        : "mic";

  return (
    <>
      <span
        onMouseEnter={() => setIsMicHovered(true)}
        onMouseLeave={() => setIsMicHovered(false)}
        style={{ display: "inline-flex", position: "relative" }}
      >
        <IconButton
          variant={showQueueButton ? "ghost" : "default"}
          size="md"
          shine={!showQueueButton}
          aria-label={
            isStreaming
              ? "Stop generation"
              : sendBlocked && !isRecording && (value || hasAttachments)
                ? sendWhenReady ? "Sending once files finish uploading" : "Waiting for files to finish uploading"
              : isRecording
                ? "Stop recording"
                : value || hasAttachments
                  ? sendQueues ? "Queue message" : "Send message"
                  : "Start voice input"
          }
          icon={
            <AnimatePresence mode="popLayout" initial={false}>
              {(() => {
                const isWave = iconKey === "wave";
                // Wave state: no filter on enter - any filter creates a GPU compositing
                // layer that kills SVG path updates inside AudioWaveDisplay.
                return (
                  <m.span
                    key={iconKey}
                    initial={
                      isWave
                        ? { scale: 0.5, opacity: 0 }
                        : { scale: 0.5, opacity: 0, filter: "blur(4px)" }
                    }
                    animate={
                      isWave
                        ? { scale: 1, opacity: 1 }
                        : { scale: 1, opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }
                    }
                    exit={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isStreaming ? (
                      <StopCircleIcon size={20} />
                    ) : isRecording ? (
                      isMicHovered ? (
                        <StopCircleIcon size={20} />
                      ) : (
                        <AudioWaveDisplay analyser={analyser} size={20} />
                      )
                    ) : value ? (
                      <ArrowUpTwoIcon
                        size={20}
                        animated
                        triggered={isMicHovered}
                      />
                    ) : (
                      <MicTwoIcon size={20} />
                    )}
                  </m.span>
                );
              })()}
            </AnimatePresence>
          }
          onClick={onAction}
          disabled={actionDisabled}
          loading={sendBlocked && !isStreaming && !isRecording && (!!value || hasAttachments)}
          title={sendBlocked && !isStreaming && !isRecording && (!!value || hasAttachments)
            ? sendWhenReady ? "Sending once files finish uploading" : "Waiting for files to finish uploading"
            : undefined}
        />
      </span>

      {/* Queue: slides in beside Stop once there's something to send.
          Its width grows from zero (the gap folded in) so Stop and the
          model selector glide aside instead of jumping. */}
      <AnimatePresence initial={false}>
        {showQueueButton && (
          <m.span
            key="queue"
            initial={reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, width: 0, marginLeft: -8, scale: 0.6, overflow: "hidden" }}
            animate={reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, width: 36, marginLeft: 0, scale: 1, transitionEnd: { overflow: "visible" } }}
            exit={reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, width: 0, marginLeft: -8, scale: 0.6, overflow: "hidden" }}
            transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 500, damping: 36 }}
            onMouseEnter={() => setIsQueueHovered(true)}
            onMouseLeave={() => setIsQueueHovered(false)}
            style={{ display: "inline-flex", flexShrink: 0 }}
          >
            <Tooltip content="Sends when this reply finishes" side="top">
              <IconButton
                variant="default"
                size="md"
                shine
                aria-label="Queue message"
                icon={<ArrowUpTwoIcon size={20} animated triggered={isQueueHovered} />}
                onClick={onQueue}
                disabled={disabled}
              />
            </Tooltip>
          </m.span>
        )}
      </AnimatePresence>
    </>
  );
}
