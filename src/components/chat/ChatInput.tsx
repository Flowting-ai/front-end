"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";
import { PINS_ENABLED } from "@/lib/feature-flags";
import { useAgentMention } from "@/hooks/use-agent-mention";
import { AgentMentionMenu } from "@/components/chat/AgentMentionMenu";
import { AGENT_CHAT_ENABLED } from "@/lib/feature-flags";
import type { ChatInputProps } from "./composer/chat-input-props";
import {
  SHADOW_DEFAULT,
  SHADOW_FOCUS,
  SHADOW_HOVER,
  getComposerSizes,
} from "./composer/composer-sizes";
import { useComposerFocus } from "./composer/use-composer-focus";
import { useChipsScroll } from "./composer/use-chips-scroll";
import { useVoiceInput, useTranscriptSync } from "./composer/use-voice-input";
import { useAutoResize } from "./composer/use-auto-resize";
import { useComposerSend } from "./composer/use-composer-send";
import { useComposerKeys, usePasteFiles } from "./composer/use-composer-keys";
import { usePinDrop } from "./composer/use-pin-drop";
import { ComposerTextarea } from "./composer/ComposerTextarea";
import { AddMenuButton } from "./composer/AddMenuButton";
import { ChipsRow } from "./composer/ChipsRow";
import { ModelPickerButton } from "./composer/ModelPickerButton";
import { SubmitControls } from "./composer/SubmitControls";

export type { ChatInputProps };

// ── Component ─────────────────────────────────────────────────────────────────
//
// The chat box. Its parts live in ./composer: the textarea, the `+` add menu,
// the chips row, the model selector and the send / stop / queue controls, plus
// the hooks behind them. Hooks are called here in a fixed order so their
// effects run in the order they always have.

export function ChatInput(
  {
    placeholder = "How can I help you today?",
    textareaLabel = "Message",
    value: controlledValue,
    onChange,
    onSend,
    onAdd,
    onStop,
    modelName = "Souvenir",
    modelIcon,
    onModelClick,
    addMenu,
    modelMenu,
    modelMenuPlacement = "bottom-end",
    textareaMaxHeight = "396px",
    chips,
    pinChips,
    attachmentsSlot,
    isStreaming = false,
    disabled = false,
    compact = false,
    onMentionChange,
    isPinDropdownOpen = false,
    onPinNavigate,
    disabledModelSelector = false,
    hideModelSelector = false,
    hideAddButton = false,
    onFilePaste,
    hasAttachments = false,
    sendBlocked = false,
    agentMention,
    allowQueue = false,
    sendQueues = false,
    onRecallQueued,
    focusRequest,
    className,
    style: callerStyle,
    onMouseEnter: externalMouseEnter,
    onMouseLeave: externalMouseLeave,
    ref,
    ...props
  }: ChatInputProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState("");
    const value = isControlled ? controlledValue : internalValue;

    const [isFocused,     setIsFocused]     = useState(false);
    const [isHovered,     setIsHovered]     = useState(false);
    const mounted = useIsClient();

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const focusedSendAtRef = useComposerFocus(textareaRef, isStreaming, focusRequest);

    // Stable ref for onChange to avoid stale closure in transcript effect
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // `@agent` mentions. Picking an agent rewrites the text (the `@word` is removed)
    // and puts the caret back where it was.
    const applyMentionText = (next: string, caret: number) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    };
    const mention = useAgentMention({
      enabled: !!agentMention && AGENT_CHAT_ENABLED,
      applyText: applyMentionText,
      onSelect: (agent) => agentMention?.onSelect(agent),
    });

    const chipsScroll = useChipsScroll(chips);
    const voice = useVoiceInput(value);
    const { isRecording } = voice;
    useAutoResize(textareaRef, value);
    useTranscriptSync(voice, isControlled, setInternalValue, onChangeRef);

    const { handleSend, sendWhenReady, holdSendUntilReady, handleQueueClick } = useComposerSend({
      value,
      isControlled,
      setInternalValue,
      onChange,
      onSend,
      hasAttachments,
      disabled,
      sendBlocked,
      isStreaming,
      allowQueue,
      textareaRef,
      focusedSendAtRef,
    });

    const { handleInputChange, handleKeyDown } = useComposerKeys({
      value,
      isControlled,
      setInternalValue,
      onChange,
      agentMentionOn: !!agentMention,
      mention,
      onMentionChange,
      isPinDropdownOpen,
      onPinNavigate,
      onRecallQueued,
      isStreaming,
      allowQueue,
      hasAttachments,
      disabled,
      isRecording,
      sendBlocked,
      handleSend,
      holdSendUntilReady,
    });
    const handlePaste = usePasteFiles(onFilePaste, isStreaming, allowQueue);
    const { isPinDragOver, handlePinDragOver, handlePinDragLeave, handlePinDrop } = usePinDrop();

    // Single handler for the action button (stop stream / stop recording / send / start recording)
    const handleActionClick = () => {
      if (isStreaming) { onStop?.(); return; }
      if (isRecording) { voice.stopRecording(); return; }
      if (value || hasAttachments) { handleSend(); return; }
      voice.startRecording();
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true);
      externalMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false);
      externalMouseLeave?.(e);
    };

    const shadow = isFocused
      ? SHADOW_FOCUS
      : isHovered
        ? SHADOW_HOVER
        : SHADOW_DEFAULT;

    // Only `disabled` locks the textarea, so it keeps focus and can be typed
    // in while a reply streams; the add menu and model selector stay locked
    // for the stream, as they were when the host disabled the whole input.
    // A message can be queued with files, so then only the model stays locked.
    const controlsDisabled = disabled || isStreaming;
    const addDisabled = disabled || (isStreaming && !allowQueue);

    // While a reply streams, a message ready to queue gets its own Queue
    // button; Stop stays beside it (quieter), never replaced by it.
    const showQueueButton = allowQueue && isStreaming && !isRecording && (!!value || hasAttachments);

    // Button is disabled only when the disabled prop is set AND there's no
    // in-progress action to cancel, AND browser doesn't support speech with
    // no text to send.
    const isActionDisabled =
      (disabled && !isStreaming && !isRecording) ||
      (sendBlocked && !isStreaming && !isRecording) ||
      (!value && !hasAttachments && !isRecording && !isStreaming && !(mounted && voice.browserSupportsSpeechRecognition));

    const { szPadding, szGap, szRadius, szBtn, szFont, szLineHeight } = getComposerSizes(compact);

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: szGap,
          width: "100%",
          maxWidth: "100%",
          padding: szPadding,
          borderRadius: szRadius,
          backgroundColor: "var(--chat-input-bg)",
          boxShadow: shadow,
          outline: isPinDragOver ? "2px dashed var(--focus-ring)" : "none",
          outlineOffset: 2,
          transition: "box-shadow 150ms, outline-color 150ms",
          cursor: disabled ? "not-allowed" : undefined,
          ...callerStyle,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
        onDragOver={handlePinDragOver}
        onDragLeave={handlePinDragLeave}
        onDrop={handlePinDrop}
      >
        {/* ── Recording state announcer (screen readers only) ── */}
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {isRecording ? "Recording started. Listening." : ""}
        </span>

        {/* ── @agent list — floats above the box while typing a mention ── */}
        {agentMention && AGENT_CHAT_ENABLED && mention.open && (
          <AgentMentionMenu
            items={mention.items}
            loading={mention.loading}
            activeIndex={mention.activeIndex}
            selectedId={agentMention.selectedAgentId ?? null}
            onPick={mention.select}
            onHover={mention.setActive}
          />
        )}

        {/* ── Attachments slot - chip strip rendered above the textarea ── */}
        {attachmentsSlot}

        {/* ── Main content - textarea + animated placeholder ── */}
        <ComposerTextarea
          textareaRef={textareaRef}
          value={value}
          placeholder={placeholder}
          textareaLabel={textareaLabel}
          textareaMaxHeight={textareaMaxHeight}
          isRecording={isRecording}
          disabled={disabled}
          szFont={szFont}
          szLineHeight={szLineHeight}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        {/* ── Footer bar ── */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "6px" }}>

          {/* Pin items row — @-mention pins and pin-folder chips, separate from feature badges */}
          {PINS_ENABLED && pinChips && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", paddingLeft: "3px", paddingRight: "3px" }}>
              {pinChips}
            </div>
          )}

          {/* Main action row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              gap: "8px",
            }}
          >
            {/* Left: attach button + chips column */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1, minWidth: 0 }}>
              {!hideAddButton && (
                <AddMenuButton addMenu={addMenu} onAdd={onAdd} disabled={addDisabled} size={szBtn} />
              )}
              {chips && <ChipsRow chips={chips} scroll={chipsScroll} />}
            </div>

            {/* Right: model selector + action button — never shrinks */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            {hideModelSelector ? null : (
              <ModelPickerButton
                modelName={modelName}
                modelIcon={modelIcon}
                onModelClick={onModelClick}
                modelMenu={modelMenu}
                modelMenuPlacement={modelMenuPlacement}
                locked={disabledModelSelector}
                disabled={controlsDisabled}
                size={szBtn}
              />
            )}

            <SubmitControls
              value={value}
              hasAttachments={hasAttachments}
              isStreaming={isStreaming}
              isRecording={isRecording}
              analyser={voice.analyser}
              sendBlocked={sendBlocked}
              sendWhenReady={sendWhenReady}
              sendQueues={sendQueues}
              disabled={disabled}
              actionDisabled={isActionDisabled}
              showQueueButton={showQueueButton}
              onAction={handleActionClick}
              onQueue={handleQueueClick}
            />
          </div>
        </div>
        </div>
      </div>
    );
}

ChatInput.displayName = "ChatInput";

export default ChatInput;
