"use client";

/**
 * usePinOperations — manages all pin state, fetching, and CRUD operations
 * that were previously embedded inside `AppLayout`.
 *
 * Responsibilities:
 *   - `pins` list and its wrapped setter (`setPins`).
 *   - `pinsChatId` — a cache-key that tracks whether the global pin list has
 *     been loaded ("all") or is stale (null).
 *   - `showPinUpgradeDialog` — whether the plan-limit upgrade nudge is open.
 *   - `loadPinsForChat` — fetches all pins from the backend, normalises them,
 *     and attempts to back-fill missing `chatId` links by matching message IDs
 *     against the loaded chat history.
 *   - `handlePinMessage` — creates a new pin on the backend, updates local
 *     state, and increments the pin-count on the relevant chat board.
 *   - `handleUnpinMessage` — deletes a pin from the backend and decrements the
 *     chat-board pin-count.
 *   - `handleChatDeleted` — clears cached pin state when a chat is permanently
 *     deleted (wired into `useChatHistory`'s `onChatDeleted` via a ref in the
 *     parent component to avoid a circular hook dependency).
 *   - `backendPinToLegacy` — pure normalisation helper; exported so callers
 *     that receive raw `BackendPin` objects (e.g. after creating a pin) can
 *     convert them without reimplementing the logic.
 *
 * NOT in scope:
 *   - Pin folder/organise operations → these live in `organize-pins-dialog.tsx`
 *     and will be addressed in Phase 3 (`useFolderTree`) or Phase 4.
 *   - Tag editing on individual pins → `useTags` (Phase 3).
 *   - Sidebar panel open/close state → stays in AppLayout UI layer; the hook
 *     accepts an `onPinSuccess` callback so AppLayout can react without the
 *     hook importing sidebar concerns.
 *
 * Cross-hook dependency pattern:
 *   `usePinOperations` needs `chatHistory` and `setChatBoards` from
 *   `useChatHistory`. The parent passes these as parameters. In return, the
 *   parent wires `loadPinsForChat` into the `loadPinsForChatRef` that
 *   `useChatHistory`'s `ensureChatOnServer` calls after a new chat is persisted.
 *
 *   Similarly, the parent passes `(chatId) => onChatDeletedRef.current(chatId)`
 *   to `useChatHistory`'s `onChatDeleted`, and then sets
 *   `onChatDeletedRef.current = handleChatDeleted` after this hook is called —
 *   ensuring the correct handler is always invoked even though `useChatHistory`
 *   is initialised first.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Message } from "@/components/chat/chat-message";
import type { PinType } from "@/components/layout/right-sidebar";
import type { ChatBoard } from "@/components/layout/app-layout";
import type { AuthUser } from "@/context/auth-context";
import {
  createPin,
  deletePin,
  fetchAllPins,
  type BackendPin,
} from "@/lib/api/pins";
import { toast } from "@/lib/toast-helper";
import { normalizeTagList, normalizeCommentStrings } from "@/lib/utils/tag-utils";
import { hasReachedLimit } from "@/lib/plan-config";

// ─── backendPinToLegacy ────────────────────────────────────────────────────────

/**
 * Converts a raw `BackendPin` payload (as returned by the REST API) into the
 * `PinType` shape used by the UI.
 *
 * An optional `fallback` object can supply values that the backend response
 * may omit (e.g. the full formatted content that the client already has from
 * the streaming response).
 */
export function backendPinToLegacy(
  pin: BackendPin,
  fallback?: Partial<PinType>,
): PinType {
  const createdAt = pin.created_at ? new Date(pin.created_at) : new Date();

  const resolvedFolder =
    (pin as { folderId?: string | null }).folderId ??
    (pin as { folder_id?: string | null }).folder_id ??
    fallback?.folderId ??
    undefined;

  const resolvedChatId =
    (pin as { chat?: string | null }).chat ??
    (pin as { sourceChatId?: string | null }).sourceChatId ??
    fallback?.sourceChatId ??
    fallback?.chatId ??
    "";

  const resolvedMessageId =
    (pin as { sourceMessageId?: string | null }).sourceMessageId ??
    (pin as { message_id?: string | null }).message_id ??
    (pin as { messageId?: string | null }).messageId ??
    fallback?.sourceMessageId ??
    fallback?.messageId ??
    null;

  const resolvedTitle =
    (pin as { title?: string | null }).title ??
    (pin as { pins_title?: string | null }).pins_title ??
    fallback?.title ??
    fallback?.text ??
    "Untitled Pin";

  const resolvedText =
    (pin as { formattedContent?: string | null }).formattedContent ??
    pin.content ??
    fallback?.formattedContent ??
    fallback?.text ??
    resolvedTitle;

  const normalizedTags = normalizeTagList(pin.tags);
  const normalizedComments = normalizeCommentStrings(
    (pin as { comments?: unknown[] }).comments,
  );

  return {
    id: pin.id,
    text: resolvedText,
    title: resolvedTitle,
    tags: normalizedTags.length > 0 ? normalizedTags : (fallback?.tags ?? []),
    notes: fallback?.notes ?? "",
    chatId: resolvedChatId,
    time: createdAt,
    messageId: resolvedMessageId ?? undefined,
    folderId: resolvedFolder || undefined,
    folderName:
      (pin as { folderName?: string | null }).folderName ?? null,
    sourceChatId: resolvedChatId,
    sourceMessageId: resolvedMessageId ?? null,
    formattedContent:
      (pin as { formattedContent?: string | null }).formattedContent ?? null,
    comments:
      normalizedComments.length > 0
        ? normalizedComments
        : (fallback?.comments ?? []),
  };
}

// ─── Hook params ────────────────────────────────────────────────────────────────

export interface UsePinOperationsParams {
  /** Whether the current user is authenticated. */
  isAuthenticated: boolean;
  /**
   * A live ref that mirrors `isAuthenticated`. Used inside async callbacks
   * to detect whether the user logged out while a fetch was in-flight.
   * Pass the same ref that AppLayout already maintains (e.g.
   * `const isAuthenticatedRef = useRef(isAuthenticated)`).
   */
  isAuthenticatedRef: React.MutableRefObject<boolean>;
  /** Current auth user — used for plan-limit checks before creating a pin. */
  user: AuthUser | null;
  /** The currently active chat ID. */
  activeChatId: string | null;
  /**
   * Whether the current page is the main chat route (`pathname === "/"`).
   * Controls when the initial pin load is triggered.
   */
  isChatRoute: boolean;
  /**
   * The full chat-history map from `useChatHistory`. Used by `loadPinsForChat`
   * to back-fill `chatId` on pins whose backend payload omits it, by matching
   * pin message IDs against the messages already loaded for the active chat.
   */
  chatHistory: Record<string, Message[]>;
  /**
   * `setChatBoards` from `useChatHistory`. Called by `handlePinMessage` and
   * `handleUnpinMessage` to keep the chat-board pin-count badge in sync.
   */
  setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
  /**
   * Optional callback fired after a pin is successfully created. The parent
   * uses this to open the pinboard right-sidebar panel without the hook needing
   * to import any sidebar concerns.
   */
  onPinSuccess?: () => void;
}

// ─── Hook implementation ────────────────────────────────────────────────────────

export function usePinOperations({
  isAuthenticated,
  isAuthenticatedRef,
  user,
  activeChatId,
  isChatRoute,
  chatHistory,
  setChatBoards,
  onPinSuccess,
}: UsePinOperationsParams) {
  // ── State ───────────────────────────────────────────────────────────────────

  const [pins, setPins_] = useState<PinType[]>([]);
  /**
   * Cache key for the global pin list.
   * - `null`  → not yet loaded (or invalidated by logout / chat deletion).
   * - `"all"` → loaded successfully.
   */
  const [pinsChatId, setPinsChatId] = useState<string | null>(null);
  /** Controls the plan-limit upgrade nudge dialog. */
  const [showPinUpgradeDialog, setShowPinUpgradeDialog] = useState(false);

  // ── Wrapped setter ──────────────────────────────────────────────────────────

  /**
   * `setPins` — stable updater that accepts either a new array or an updater
   * function, matching the API of the raw React setter while keeping the raw
   * `setPins_` private to this hook.
   *
   * Exposed in the return value so the parent / RightSidebar can perform
   * direct mutations (e.g. folder moves, tag edits) without needing a
   * dedicated callback for each operation.
   */
  const setPins = useCallback(
    (updater: PinType[] | ((prev: PinType[]) => PinType[])) => {
      setPins_((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [],
  );

  // ── loadPinsForChat ─────────────────────────────────────────────────────────

  /**
   * Fetches the complete global pin list from the backend, normalises each pin,
   * and attempts to recover missing `chatId` links by matching pin message IDs
   * against the messages loaded for `_chatId` (the active chat at call time).
   *
   * The result is stored globally (keyed by `"all"`) rather than per-chat
   * because the backend endpoint returns all pins regardless of chat.
   *
   * If the user logs out while this call is in-flight the result is discarded
   * (guarded by `isAuthenticatedRef.current`).
   */
  const loadPinsForChat = useCallback(
    async (_chatId: string | null = null) => {
      if (!isAuthenticated) return;
      try {
        const backendPins = await fetchAllPins();
        if (!isAuthenticatedRef.current) return;

        const normalized = backendPins.map((bp) => backendPinToLegacy(bp));

        // Attempt to back-fill chatId on pins whose backend response omits it,
        // by matching their messageId against messages already loaded for the
        // active chat.
        const activeMessageIds = _chatId
          ? new Set(
              (chatHistory[_chatId] ?? [])
                .map((msg) => {
                  const rawId = msg.chatMessageId ?? msg.id;
                  return rawId !== undefined && rawId !== null
                    ? String(rawId)
                    : "";
                })
                .filter((id) => id.length > 0),
            )
          : new Set<string>();

        const normalizedWithChatLink = normalized.map((pin) => {
          const existingChatId = String(pin.chatId || pin.sourceChatId || "");
          if (
            existingChatId.length > 0 ||
            !_chatId ||
            activeMessageIds.size === 0
          ) {
            return pin;
          }
          const pinMessageId = String(
            pin.messageId || pin.sourceMessageId || "",
          );
          if (!pinMessageId || !activeMessageIds.has(pinMessageId)) return pin;
          return {
            ...pin,
            chatId: _chatId,
            sourceChatId: pin.sourceChatId ?? _chatId,
          };
        });

        setPins_(normalizedWithChatLink);
        setPinsChatId("all");

        // Update the chat board's pin-count badge for the requested chat.
        setChatBoards((prev) =>
          prev.map((board) =>
            board.id === _chatId
              ? { ...board, pinCount: normalizedWithChatLink.length }
              : board,
          ),
        );
      } catch (error) {
        console.error("[usePinOperations/loadPinsForChat] Failed:", error);
        if (!isAuthenticatedRef.current) return;
        setPins_([]);
        setPinsChatId("all");
      }
    },
    // chatHistory deliberately omitted: we only want the latest snapshot at
    // call time (not to re-create the callback whenever any message changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, setChatBoards],
  );

  // Keep a stable ref so effects that fire on activeChatId/isChatRoute changes
  // always call the most-recent version without adding it to their dep arrays.
  const loadPinsForChatRef = useRef(loadPinsForChat);
  loadPinsForChatRef.current = loadPinsForChat;

  // ── handleChatDeleted ───────────────────────────────────────────────────────

  /**
   * Called by `useChatHistory`'s `onChatDeleted` (via an `onChatDeletedRef`
   * in the parent) when a chat is permanently deleted. Clears the pin cache if
   * the deleted chat was the one whose pins are currently cached.
   *
   * Note: the global cache key is `"all"`, not the specific chat ID, so we
   * simply reset to `null` to force a fresh reload the next time the chat
   * route is visited rather than trying to filter the existing list.
   */
  const handleChatDeleted = useCallback(
    (deletedChatId: string) => {
      setPinsChatId((prev) => {
        if (prev === deletedChatId || prev === "all") return null;
        return prev;
      });
      // Clear the pin list optimistically so stale entries don't linger.
      setPins_((prev) =>
        prev.filter(
          (pin) =>
            String(pin.chatId || pin.sourceChatId || "") !== deletedChatId,
        ),
      );
    },
    [],
  );

  // ── handlePinMessage ────────────────────────────────────────────────────────

  /**
   * Creates a new pin on the backend for the given message, optimistically
   * updates the local pin list and chat-board pin-count, and notifies the
   * parent via `onPinSuccess` (e.g. to open the pinboard sidebar panel).
   *
   * Throws on network failure so callers can surface errors to the user.
   */
  const handlePinMessage = useCallback(
    async (pinRequest: PinType) => {
      // Plan-limit guard — show the upgrade dialog and bail out early.
      if (user?.planType && hasReachedLimit(user.planType, "pins", pins.length)) {
        setShowPinUpgradeDialog(true);
        return;
      }

      const chatId = pinRequest.chatId || activeChatId;
      const messageId = pinRequest.messageId || pinRequest.id;
      if (!chatId || !messageId) {
        console.warn(
          "[usePinOperations/handlePinMessage] Missing chatId or messageId",
        );
        return;
      }

      try {
        const backendPin = await createPin(chatId, messageId, {
          folderId: pinRequest.folderId ?? null,
          tags: pinRequest.tags,
          comments: pinRequest.comments,
          content: pinRequest.text,
        });

        const normalized = backendPinToLegacy(backendPin, pinRequest);

        // Prepend and deduplicate by id.
        setPins_((prev) => [
          normalized,
          ...prev.filter((p) => p.id !== normalized.id),
        ]);

        // Increment the chat board's pin-count badge.
        setChatBoards((prev) =>
          prev.map((board) =>
            board.id === chatId
              ? {
                  ...board,
                  pinCount: (board.pinCount || 0) + 1,
                  metadata: {
                    ...board.metadata,
                    pinCount: (board.pinCount || 0) + 1,
                  },
                }
              : board,
          ),
        );

        // Notify the parent so it can open the pinboard sidebar.
        onPinSuccess?.();
        toast("Pinned!", {
          description: "Response has been pinned to your pinboard.",
        });
      } catch (error) {
        console.error("[usePinOperations/handlePinMessage] Failed:", error);
        throw error;
      }
    },
    [activeChatId, onPinSuccess, pins.length, setChatBoards, user],
  );

  // ── handleUnpinMessage ──────────────────────────────────────────────────────

  /**
   * Deletes the pin associated with `messageId` from the backend and removes
   * it from the local state. Also decrements the chat-board pin-count badge.
   *
   * Throws on network failure so callers can surface errors to the user.
   */
  const handleUnpinMessage = useCallback(
    async (messageId: string) => {
      const pinToRemove = pins.find(
        (pin) => pin.messageId === messageId || pin.id === messageId,
      );
      if (!pinToRemove) return;

      try {
        await deletePin(pinToRemove.id);

        setPins_((prev) => prev.filter((pin) => pin.id !== pinToRemove.id));

        // Decrement the chat board's pin-count badge (floor at 0).
        setChatBoards((prev) =>
          prev.map((board) =>
            board.id === pinToRemove.chatId
              ? {
                  ...board,
                  pinCount: Math.max(0, (board.pinCount || 1) - 1),
                  metadata: {
                    ...board.metadata,
                    pinCount: Math.max(0, (board.pinCount || 1) - 1),
                  },
                }
              : board,
          ),
        );
      } catch (error) {
        console.error("[usePinOperations/handleUnpinMessage] Failed:", error);
        throw error;
      }
    },
    [pins, setChatBoards],
  );

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Clear pins when the user logs out.
  useEffect(() => {
    if (!isAuthenticated) {
      setPins_([]);
      setPinsChatId(null);
    }
  }, [isAuthenticated]);

  // Load pins on the initial visit to the chat route (once per session, or
  // whenever the cache is invalidated by logout / chat deletion).
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!pinsChatId && isChatRoute) {
      void loadPinsForChatRef.current(activeChatId ?? null);
    }
  }, [activeChatId, isAuthenticated, isChatRoute, pinsChatId]);

  // ── Return value ─────────────────────────────────────────────────────────────

  return {
    // State
    pins,
    setPins,
    pinsChatId,
    setPinsChatId,
    showPinUpgradeDialog,
    setShowPinUpgradeDialog,
    // Operations
    loadPinsForChat,
    handlePinMessage,
    handleUnpinMessage,
    handleChatDeleted,
  };
}

/** Convenience type alias. */
export type PinOperationsReturn = ReturnType<typeof usePinOperations>;
