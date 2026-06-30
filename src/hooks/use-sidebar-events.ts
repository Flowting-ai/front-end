"use client";

import { useEffect } from "react";

const SIDEBAR_OPEN_EVENT = "sidebar:open";
const SIDEBAR_CLOSE_EVENT = "sidebar:close";
const SIDEBAR_NEW_CHAT_EVENT = "sidebar:new-chat";
export const PERSONA_CHAT_CREATED_EVENT = "persona:chat-created";
const PERSONA_CHAT_TITLE_UPDATED_EVENT = "persona:chat-title-updated";
export const BRAIN_THREAD_CREATED_EVENT = "brain:thread-created";
// Fired by the shared LeftSidebar's "New thread" button while on a brain page.
// The brain page listens and runs its imperative new-thread reset (the reset
// can't be driven by URL navigation alone — see handleNewChat in brain/page).
export const BRAIN_NEW_THREAD_EVENT = "brain:new-thread";
export const BRAIN_THREAD_TITLE_UPDATED_EVENT = "brain:thread-title-updated";
export const BRAIN_THREAD_DELETED_EVENT = "brain:thread-deleted";
export const CHAT_CREATED_EVENT = "chat:created";

export interface PersonaChatEventDetail {
  personaId: string;
  chatId: string;
  title: string;
}

export interface BrainThreadEventDetail {
  chatId: string;
  title: string;
}

export interface BrainThreadDeletedEventDetail {
  chatId: string;
}

export interface ChatCreatedEventDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  starred: boolean;
  can_edit: boolean;
}

export function emitSidebarOpen() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIDEBAR_OPEN_EVENT));
  }
}

export function emitSidebarClose() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIDEBAR_CLOSE_EVENT));
  }
}

export function emitSidebarNewChat() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIDEBAR_NEW_CHAT_EVENT));
  }
}

export function emitPersonaChatCreated(detail: PersonaChatEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PERSONA_CHAT_CREATED_EVENT, { detail }));
  }
}

export function emitPersonaChatTitleUpdated(detail: PersonaChatEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PERSONA_CHAT_TITLE_UPDATED_EVENT, { detail }));
  }
}

export function emitChatCreated(detail: ChatCreatedEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHAT_CREATED_EVENT, { detail }));
  }
}

export function emitBrainNewThread() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BRAIN_NEW_THREAD_EVENT));
  }
}

export function emitBrainThreadCreated(detail: BrainThreadEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BRAIN_THREAD_CREATED_EVENT, { detail }));
  }
}

export function emitBrainThreadTitleUpdated(detail: BrainThreadEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BRAIN_THREAD_TITLE_UPDATED_EVENT, { detail }));
  }
}

export function emitBrainThreadDeleted(detail: BrainThreadDeletedEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BRAIN_THREAD_DELETED_EVENT, { detail }));
  }
}

export function useSidebarEvents(handlers: {
  onOpen?: () => void;
  onClose?: () => void;
  onNewChat?: () => void;
}) {
  useEffect(() => {
    const { onOpen, onClose, onNewChat } = handlers;
    const handleOpen = () => onOpen?.();
    const handleClose = () => onClose?.();
    const handleNewChat = () => onNewChat?.();

    window.addEventListener(SIDEBAR_OPEN_EVENT, handleOpen);
    window.addEventListener(SIDEBAR_CLOSE_EVENT, handleClose);
    window.addEventListener(SIDEBAR_NEW_CHAT_EVENT, handleNewChat);

    return () => {
      window.removeEventListener(SIDEBAR_OPEN_EVENT, handleOpen);
      window.removeEventListener(SIDEBAR_CLOSE_EVENT, handleClose);
      window.removeEventListener(SIDEBAR_NEW_CHAT_EVENT, handleNewChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.onOpen, handlers.onClose, handlers.onNewChat]);
}
