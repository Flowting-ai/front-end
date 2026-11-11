import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { registerChatScroller } from "@/lib/chat-scroller";
import {
  createStickToBottom,
  scrollIntentForKey,
  USER_SCROLL_WINDOW_MS,
  type StickToBottom,
} from "@/lib/stick-to-bottom";
import type { UIMessage } from "@/types/chat";
import type { ChatMessageListHandle } from "../ChatMessageList";

// After a reply finishes, keep following content growth this long (lazy code
// highlighting, chart mounts) before growth counts as the user's own doing.
const FOLLOW_GRACE_MS = 1_500;

/**
 * Whether the view follows new content at the bottom ("stuck") — see
 * stick-to-bottom.ts. `atBottom` mirrors it for the scroll-to-bottom button.
 */
export function useStickToBottom() {
  const [stickToBottom] = useState(() => createStickToBottom());
  const [atBottom, setAtBottom] = useState(true);

  // True during the brief window after messages load while the virtualizer
  // measures all rendered items. Keeps the spinner up and content hidden so
  // the first visible frame is already at settled positions (no jitter).
  const [isSettling, setIsSettling] = useState(false);

  // Schedules a frame that scrolls to the bottom while stuck; installed by the
  // follow effect in useChatScroll.
  const scheduleFollowRef = useRef<() => void>(() => {});

  // A user's own send always returns the view to the bottom and follows the
  // new reply, unlike passively arriving content, which never yanks someone
  // away from history they scrolled up to read — sending is an explicit
  // action by the user, not a background event.
  const stickAndFollow = () => {
    stickToBottom.stick();
    setAtBottom(true);
    scheduleFollowRef.current();
  };

  return { stickToBottom, atBottom, setAtBottom, isSettling, setIsSettling, scheduleFollowRef, stickAndFollow };
}

/**
 * Registers the virtualizer-backed scroller so jump-gutter / highlight-panel
 * can bring virtualized messages into view before querying the DOM.
 */
export function useChatScrollerRegistration(
  messages: UIMessage[],
  listRef: RefObject<ChatMessageListHandle | null>,
  stickToBottom: StickToBottom,
  setAtBottom: (atBottom: boolean) => void,
) {
  // The row-render poll outlives re-registering (it runs on every messages change),
  // but not the chat: it is cleared on unmount.
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(pollRef.current), [])
  useEffect(() => {
    return registerChatScroller((messageId, onRendered) => {
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return
      // A jump the user asked for — stop following the bottom so new content
      // doesn't pull the view straight back down.
      stickToBottom.unstick()
      setAtBottom(false)
      listRef.current?.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })
      // Poll until the row renders in the DOM (up to 40 × 50 ms = 2 s)
      let attempts = 0
      clearInterval(pollRef.current)
      const poll = setInterval(() => {
        const el = document.querySelector(`[data-message-id="${messageId}"]`)
        if (el || attempts++ >= 40) {
          clearInterval(poll)
          if (el) onRendered(el)
        }
      }, 50)
      pollRef.current = poll
    }, () => {
      stickToBottom.unstick()
      setAtBottom(false)
    })
  }, [messages, stickToBottom, setAtBottom, listRef])
}

/**
 * Whether a reply is still arriving or revealing — the only time content
 * growth should drive the follow (see useChatScroll). Read from a ref by the
 * ResizeObserver; the grace covers growth that lands just after.
 */
export function useFollowLive(isStreaming: boolean, revealingKey: string | null) {
  const followLiveRef = useRef({ live: false, graceUntil: 0 });
  useEffect(() => {
    const live = isStreaming || revealingKey !== null;
    if (followLiveRef.current.live && !live) {
      followLiveRef.current.graceUntil = performance.now() + FOLLOW_GRACE_MS;
    }
    followLiveRef.current.live = live;
  }, [isStreaming, revealingKey]);
  return followLiveRef;
}

/**
 * Scroll position on load, following the bottom while stuck, and the
 * scroller's onScroll / scroll-to-bottom handlers.
 */
export function useChatScroll({
  messages,
  historyLoadId,
  hasMoreMessages,
  loadMoreMessages,
  scrollToMessageId,
  listRef,
  scrollerRef,
  listElementRef,
  stickToBottom,
  setAtBottom,
  isSettling,
  setIsSettling,
  scheduleFollowRef,
  followLiveRef,
}: {
  messages: UIMessage[];
  /** Bumped once per opened thread by useChatState — see its doc comment. */
  historyLoadId: number;
  hasMoreMessages: boolean;
  loadMoreMessages: () => void;
  scrollToMessageId: string | null | undefined;
  listRef: RefObject<ChatMessageListHandle | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  listElementRef: RefObject<HTMLDivElement | null>;
  stickToBottom: StickToBottom;
  setAtBottom: (atBottom: boolean) => void;
  isSettling: boolean;
  setIsSettling: (settling: boolean) => void;
  scheduleFollowRef: RefObject<() => void>;
  followLiveRef: RefObject<{ live: boolean; graceUntil: number }>;
}) {
  // Scroll to bottom instantly when a chat's history is installed (opening an
  // existing chat). Keyed on historyLoadId rather than an isLoadingMessages
  // false→true→false round trip: a cached history is installed without ever
  // going through a loading state, and this still has to fire exactly once per
  // opened thread — never on a subsequent message change, and never when
  // pagination prepends older messages (which does not bump the id).
  const prevLoadIdRef = useRef(historyLoadId);
  const scrolledToMessageRef = useRef<string | null>(null);
  useEffect(() => {
    const changed = prevLoadIdRef.current !== historyLoadId;
    prevLoadIdRef.current = historyLoadId;
    if (changed && messages.length > 0) {
      // Enter settling: keep spinner up while the virtualizer renders and
      // measures all initial items. The effect below clears it.
      setIsSettling(true);

      // Scroll to target position while content is still hidden so the
      // virtualizer places items at correct offsets before reveal.
      if (scrollToMessageId && scrolledToMessageRef.current !== scrollToMessageId) {
        const idx = messages.findIndex((m) => m.id === scrollToMessageId);
        if (idx !== -1) {
          scrolledToMessageRef.current = scrollToMessageId;
          stickToBottom.unstick();
          setAtBottom(false);
          listRef.current?.scrollToIndex(idx, { align: 'start', behavior: 'auto' });
        }
      } else {
        stickToBottom.stick();
        setAtBottom(true);
        listRef.current?.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' });
      }
    }
  }, [historyLoadId, messages, scrollToMessageId, stickToBottom, setAtBottom, setIsSettling, listRef]);

  // Leave settling two frames later, so the browser finishes its layout pass and
  // the first visible frame is already at settled positions. Keyed on isSettling
  // alone: while this lived in the effect above, any `messages` identity change
  // in the same commit ran that effect's cleanup and cancelled the pending
  // frame, and its `wasLoading` guard meant the re-run could never reschedule —
  // stranding the list mounted, measured, and permanently `visibility: hidden`.
  useEffect(() => {
    if (!isSettling) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setIsSettling(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [isSettling, setIsSettling]);

  // Follow the bottom while stuck. Driven by the list's size rather than by
  // `messages`, so it also tracks growth that happens after a chunk lands or
  // after the stream ends — the text reveal's tail, lazily highlighted code,
  // charts — and the scroller itself resizing. Growth never unsticks the view;
  // only the user's own gestures, recorded here, can (see stick-to-bottom.ts).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listElementRef.current;
    if (!scroller || !list) return;

    let frame = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const follow = () => {
      frame = 0;
      if (!stickToBottom.stuck) return;
      if (!stickToBottom.canFollow(performance.now())) {
        // Held off mid-gesture; look again once the gesture window has passed.
        clearTimeout(retry);
        retry = setTimeout(schedule, USER_SCROLL_WINDOW_MS);
        return;
      }
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(follow);
    };
    scheduleFollowRef.current = schedule;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!stickToBottom.stuck) return;
      // The scroller resizing (window, composer height) always keeps the bottom
      // pinned. The list growing only follows while a reply is arriving or
      // revealing (plus a short grace for late code highlighting and charts):
      // growth when nothing is arriving is the user's own doing, e.g.
      // expanding a Thinking panel, and must not scroll it out from under them.
      const scrollerResized = entries.some((entry) => entry.target === scroller);
      const { live, graceUntil } = followLiveRef.current;
      if (scrollerResized || live || performance.now() < graceUntil) schedule();
    });
    resizeObserver.observe(list);
    resizeObserver.observe(scroller);

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) stickToBottom.userIntent(e.deltaY < 0 ? "up" : "down", performance.now());
    };
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      // A finger moving down drags the content down, toward history.
      stickToBottom.userIntent(touchY !== null && y > touchY ? "up" : "down", performance.now());
      touchY = y;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Keys typed into a field (e.g. editing a message) don't scroll the chat.
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) return;
      const direction = scrollIntentForKey(e.key, e.shiftKey);
      if (direction) stickToBottom.userIntent(direction, performance.now());
    };
    // A press on the scroller itself rather than on a message is a scrollbar drag.
    const onPointerDown = (e: PointerEvent) => {
      if (e.target === scroller) stickToBottom.pointerDown();
    };
    const onPointerUp = () => {
      if (stickToBottom.pointerUp(performance.now()) && stickToBottom.stuck) schedule();
    };

    scroller.addEventListener("wheel", onWheel, { passive: true });
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: true });
    scroller.addEventListener("keydown", onKeyDown);
    scroller.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
      resizeObserver.disconnect();
      scheduleFollowRef.current = () => {};
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("keydown", onKeyDown);
      scroller.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [stickToBottom, scrollerRef, listElementRef, scheduleFollowRef, followLiveRef]);

  // Scroll-to-top for pagination + stick/unstick from the scroll position.
  // setAtBottom only re-renders when the value actually flips.
  const handleScroll = () => {
    const container = scrollerRef.current;
    if (!container) return;
    if (container.scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
    setAtBottom(stickToBottom.onScroll(container, performance.now()));
  };

  const scrollToBottom = useCallback(() => {
    if (messages.length === 0) return;
    stickToBottom.stick();
    setAtBottom(true);
    listRef.current?.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
  }, [messages.length, stickToBottom, setAtBottom, listRef]);

  return { handleScroll, scrollToBottom };
}
