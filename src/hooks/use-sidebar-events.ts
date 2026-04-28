"use client";

/**
 * useSidebarEvents — subscribes to window-level custom events dispatched by
 * persona and workflow chat pages, and manages the browser-tab document title.
 *
 * ─── Window event subscriptions ────────────────────────────────────────────
 *
 * "persona-chats-updated"
 *   Dispatched by PersonaChatFullPage whenever a new conversation is created.
 *   Triggers a fresh fetch of the persona's chat list so the sidebar stays in
 *   sync without requiring a full page reload.
 *
 * "persona-chat-title-updated"
 *   Dispatched by PersonaChatFullPage when the AI generates a title for the
 *   active conversation. Patches the local `personaChats` map inline: if the
 *   chat already exists its title is updated; if it is brand-new (optimistic)
 *   the entry is prepended to the top of the persona's list.
 *
 * "persona-chat-id-resolved"
 *   Dispatched by PersonaChatFullPage when the backend assigns a permanent id
 *   to a conversation that was created optimistically with a `"temp-*"` id.
 *   Swaps the temporary id for the permanent one in `personaChats`, removes
 *   any duplicate that may have been fetched in parallel, and patches
 *   `activePersonaChatSessionId` when the user is actively viewing that chat.
 *
 * ─── Document title management ─────────────────────────────────────────────
 *
 * Derives a human-readable browser-tab title from the current route and the
 * active chat/workflow/persona session, applying a three-tier precedence:
 *
 *   1. Persona chat (highest): "<PersonaName> – <ChatTitle>"
 *   2. Workflow chat:          "<WorkflowName>"
 *   3. Main chat board:        "<ChatBoardName>"
 *   fallback:                  APP_BASE_TITLE ("Souvenir AI")
 *
 * While the app is on a chat-related route but the async data has not yet
 * loaded (title would fall back to the base title), the existing title is
 * preserved to prevent a distracting flash.
 *
 * ─── NOT in scope ──────────────────────────────────────────────────────────
 *   - Persona list / workflow list data fetching
 *   - Typewriter animation (uses its own interval ref pattern)
 *   - Route-driven sidebar expand/collapse state
 *   - Settings scroll persistence
 *   - Search / filter state
 */

import { useState, useEffect, useCallback } from "react";
import type { ChatBoard } from "@/components/layout/app-layout";
import type { PersonaChat } from "@/lib/api/personas";
import type { WorkflowMetadata } from "@/components/workflows/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_BASE_TITLE = "Souvenir AI";

// ─── Custom event payload types ───────────────────────────────────────────────

interface PersonaChatsUpdatedDetail {
  personaId: string;
}

interface PersonaChatTitleUpdatedDetail {
  personaId: string;
  chatId: string;
  title: string;
}

interface PersonaChatIdResolvedDetail {
  personaId: string;
  tempChatId: string;
  chatId: string;
}

// ─── Hook params ──────────────────────────────────────────────────────────────

export interface UseSidebarEventsParams {
  // ── Window event callbacks ───────────────────────────────────────────────
  /**
   * Called when `"persona-chats-updated"` fires. Typically re-fetches the
   * full chat list for the given persona id (e.g. `loadPersonaChats`).
   */
  onPersonaChatsUpdated: (personaId: string) => void;

  /**
   * Updater for the full `personaChats` map. Called from both
   * `"persona-chat-title-updated"` and `"persona-chat-id-resolved"` handlers
   * so the state remains in the parent component (single source of truth).
   */
  setPersonaChats: React.Dispatch<
    React.SetStateAction<Record<string, PersonaChat[]>>
  >;

  /**
   * Updater for the currently active persona chat session id. Called from the
   * `"persona-chat-id-resolved"` handler to swap a temporary id for its
   * permanent counterpart.
   */
  setActivePersonaChatSessionId: React.Dispatch<
    React.SetStateAction<string | null>
  >;

  // ── Document title dependencies ──────────────────────────────────────────
  /** Whether the user is currently on the main chat board route ("/", "/chats"). */
  isOnChatBoard: boolean;
  /** Whether the user is on a workflow chat page (e.g. "/workflows/:id/chat"). */
  isOnWorkflowChatPage: boolean;
  /** Whether the user is on a persona chat page (e.g. "/personas/:id/chat"). */
  isOnPersonaChatPage: boolean;
  /** The currently active chat board id (for main chat title derivation). */
  activeChatId: string | null;
  /** All loaded chat boards (used to find the active board's name). */
  chatBoards: ChatBoard[];
  /** Workflow id extracted from the current URL path. */
  activeWorkflowIdFromUrl: string | null;
  /** Loaded workflow list (used to find the active workflow's name). */
  workflowList: WorkflowMetadata[];
  /** Persona id extracted from the current URL path. */
  activePersonaIdFromUrl: string | null;
  /** The currently active persona chat session id. */
  activePersonaChatSessionId: string | null;
  /** Loaded persona list (used to find the active persona's name). */
  personaList: Array<{ id: string; name: string; isActive: boolean }>;
  /** Persona chats keyed by persona id (used to find the active chat's title). */
  personaChats: Record<string, PersonaChat[]>;
}

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useSidebarEvents({
  onPersonaChatsUpdated,
  setPersonaChats,
  setActivePersonaChatSessionId,
  isOnChatBoard,
  isOnWorkflowChatPage,
  isOnPersonaChatPage,
  activeChatId,
  chatBoards,
  activeWorkflowIdFromUrl,
  workflowList,
  activePersonaIdFromUrl,
  activePersonaChatSessionId,
  personaList,
  personaChats,
}: UseSidebarEventsParams) {
  // ── Document title state ─────────────────────────────────────────────────

  const [documentTitle, setDocumentTitle] = useState(APP_BASE_TITLE);

  // ── Window event handlers ─────────────────────────────────────────────────

  /**
   * "persona-chats-updated" — a new chat was created in PersonaChatFullPage;
   * re-fetch the chat list for that persona so the sidebar stays current.
   */
  const handlePersonaChatsUpdated = useCallback(
    (e: Event) => {
      const personaId = (e as CustomEvent<PersonaChatsUpdatedDetail>).detail
        ?.personaId;
      if (personaId) {
        onPersonaChatsUpdated(personaId);
      }
    },
    [onPersonaChatsUpdated],
  );

  /**
   * "persona-chat-title-updated" — PersonaChatFullPage assigned a title to the
   * active conversation. If the chat is already in the list its title is
   * updated in place; otherwise the entry is prepended (optimistic insert).
   */
  const handlePersonaChatTitleUpdated = useCallback(
    (e: Event) => {
      const { personaId, chatId, title } = (
        e as CustomEvent<PersonaChatTitleUpdatedDetail>
      ).detail ?? {};
      if (!personaId || !chatId || !title) return;

      setPersonaChats((prev) => {
        const existing = prev[personaId] ?? [];
        const hasEntry = existing.some((c) => c.id === chatId);

        if (hasEntry) {
          return {
            ...prev,
            [personaId]: existing.map((c) =>
              c.id === chatId ? { ...c, chat_title: title } : c,
            ),
          };
        }

        // New chat — prepend so it appears at the top of the list.
        return {
          ...prev,
          [personaId]: [
            { id: chatId, chat_title: title, message_count: 1 },
            ...existing,
          ],
        };
      });
    },
    [setPersonaChats],
  );

  /**
   * "persona-chat-id-resolved" — the backend assigned a permanent id to a chat
   * that was initially created with a temporary `"temp-*"` id.
   *
   * Steps:
   *   1. Replace the temp id with the permanent one in the chat list.
   *   2. Deduplicate: if a parallel fetch already inserted the permanent entry,
   *      remove the temporary duplicate to avoid two rows.
   *   3. If the user is currently viewing the temp-id chat, update the active
   *      session id to point at the permanent one.
   */
  const handlePersonaChatIdResolved = useCallback(
    (e: Event) => {
      const { personaId, tempChatId, chatId } = (
        e as CustomEvent<PersonaChatIdResolvedDetail>
      ).detail ?? {};
      if (!personaId || !tempChatId || !chatId) return;

      setPersonaChats((prev) => {
        const existing = prev[personaId] ?? [];
        if (existing.length === 0) return prev;

        const hasResolved = existing.some((c) => c.id === chatId);

        const next = existing
          .map((c) => (c.id === tempChatId ? { ...c, id: chatId } : c))
          // If the permanent entry already existed AND we just renamed the temp
          // entry to match it, filter out the now-duplicated "New Chat" row.
          .filter(
            (c) =>
              !(hasResolved && c.id === chatId && c.chat_title === "New Chat"),
          );

        return { ...prev, [personaId]: next };
      });

      // Patch the active session id so navigation/selection stays correct.
      setActivePersonaChatSessionId((prev) =>
        prev === tempChatId ? chatId : prev,
      );
    },
    [setPersonaChats, setActivePersonaChatSessionId],
  );

  // ── Window event subscriptions ────────────────────────────────────────────

  useEffect(() => {
    window.addEventListener("persona-chats-updated", handlePersonaChatsUpdated);
    return () =>
      window.removeEventListener(
        "persona-chats-updated",
        handlePersonaChatsUpdated,
      );
  }, [handlePersonaChatsUpdated]);

  useEffect(() => {
    window.addEventListener(
      "persona-chat-title-updated",
      handlePersonaChatTitleUpdated,
    );
    return () =>
      window.removeEventListener(
        "persona-chat-title-updated",
        handlePersonaChatTitleUpdated,
      );
  }, [handlePersonaChatTitleUpdated]);

  useEffect(() => {
    window.addEventListener(
      "persona-chat-id-resolved",
      handlePersonaChatIdResolved,
    );
    return () =>
      window.removeEventListener(
        "persona-chat-id-resolved",
        handlePersonaChatIdResolved,
      );
  }, [handlePersonaChatIdResolved]);

  // ── Document title derivation ─────────────────────────────────────────────

  /**
   * Computes the desired browser-tab title from the current route and the
   * loaded data. Three-tier precedence: persona chat > workflow chat > main
   * chat board > APP_BASE_TITLE.
   *
   * When on a chat-related route but the data has not yet loaded (the derived
   * title would fall back to the base title), the existing title is preserved
   * so the tab doesn't flash back to "Souvenir AI" during async loading.
   */
  useEffect(() => {
    const inChatContext =
      isOnChatBoard || isOnWorkflowChatPage || isOnPersonaChatPage;

    let nextTitle: string = APP_BASE_TITLE;

    // 1) Persona chat (highest precedence).
    if (isOnPersonaChatPage && activePersonaIdFromUrl) {
      const persona = personaList.find((p) => p.id === activePersonaIdFromUrl);

      if (activePersonaChatSessionId && activePersonaIdFromUrl) {
        const chat = (personaChats[activePersonaIdFromUrl] ?? []).find(
          (c) => c.id === activePersonaChatSessionId,
        );
        if (chat?.chat_title) {
          nextTitle = persona?.name
            ? `${persona.name} – ${chat.chat_title}`
            : chat.chat_title;
        }
      } else if (persona?.name) {
        nextTitle = persona.name;
      }
    }

    // 2) Workflow chat.
    if (
      nextTitle === APP_BASE_TITLE &&
      isOnWorkflowChatPage &&
      activeWorkflowIdFromUrl
    ) {
      const activeWorkflow = workflowList.find(
        (wf) => wf.id === activeWorkflowIdFromUrl,
      );
      if (activeWorkflow?.name) {
        nextTitle = activeWorkflow.name;
      }
    }

    // 3) Main chat board.
    if (nextTitle === APP_BASE_TITLE && isOnChatBoard && activeChatId) {
      const activeBoard = chatBoards.find((b) => b.id === activeChatId);
      if (activeBoard?.name) {
        nextTitle = activeBoard.name;
      }
    }

    // While in a chat-related route but data is still loading, keep the
    // existing title rather than flashing back to the base title.
    if (inChatContext && nextTitle === APP_BASE_TITLE) return;

    setDocumentTitle((prev) => (prev !== nextTitle ? nextTitle : prev));
  }, [
    isOnChatBoard,
    isOnWorkflowChatPage,
    isOnPersonaChatPage,
    activeChatId,
    chatBoards,
    activeWorkflowIdFromUrl,
    workflowList,
    activePersonaIdFromUrl,
    activePersonaChatSessionId,
    personaList,
    personaChats,
  ]);

  // ── Apply derived title to the browser tab ────────────────────────────────

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = documentTitle;
  }, [documentTitle]);

  // ── Return value ──────────────────────────────────────────────────────────

  return {
    /** The currently computed browser-tab title. Exposed for debugging / SSR. */
    documentTitle,
  };
}

/** Convenience type alias. */
export type SidebarEventsReturn = ReturnType<typeof useSidebarEvents>;
