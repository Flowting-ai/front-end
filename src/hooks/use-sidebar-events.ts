"use client";

import { useEffect } from "react";

const SIDEBAR_OPEN_EVENT = "sidebar:open";
const SIDEBAR_CLOSE_EVENT = "sidebar:close";
const SIDEBAR_NEW_CHAT_EVENT = "sidebar:new-chat";

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
