"use client"

import { useRef, useLayoutEffect, useEffect, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import type { SelectedPersonaInfo } from "@/components/chat/AddMenu"

/**
 * Picks up a persona staged in `sessionStorage` by another page just before
 * it navigated to a blank new-chat route — e.g. agents/published's "Use this
 * Agent" button (`/chat`), or the project overview's own composer send
 * (`/project/[id]/chat/[chatId]`, chatId "new"). Optionally shows a "model
 * locked to agent" notice for that handoff.
 *
 * Reads synchronously via `useLayoutEffect` (before paint/interaction) rather
 * than a lazy `useState` initializer branching on `typeof window` — that
 * branch made the initializer's return value differ between the server
 * render and the client's first render, a real hydration mismatch whenever a
 * pending persona was actually present. `useLayoutEffect` still lands before
 * the initial-send path can possibly fire, so the guarantee is unchanged.
 *
 * `shouldCheck` gates the read (evaluated once, at mount) — pass whatever
 * this route's own "this is a genuinely blank new chat" condition is.
 *
 * Returns the "came from a pending handoff" ref so the caller's own
 * settings-sync effect can consult (and consume) it if needed — a blank
 * landing right after this handoff must not immediately reset the persona
 * it just set.
 */
export function usePendingPersonaHandoff(
  storageKey: string,
  shouldCheck: boolean,
  setSelectedPersona: Dispatch<SetStateAction<SelectedPersonaInfo | null>>,
  options?: { toastMessage?: { title: string; description: string } },
) {
  const cameFromPendingPersonaRef = useRef(false);

  useLayoutEffect(() => {
    if (!shouldCheck) return;
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return;
    sessionStorage.removeItem(storageKey);
    try {
      const parsed = JSON.parse(stored) as SelectedPersonaInfo;
      cameFromPendingPersonaRef.current = true;
      setSelectedPersona(parsed);
    } catch { /* ignore malformed sessionStorage value */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same "Model locked to agent" notice ChatInput/TopBar already show on a
  // click against the locked model selector — surfaced proactively here since
  // arriving with the agent pre-attached is a less visually obvious moment
  // than picking one from the composer's own "+" menu, where the chip
  // appearing is the feedback. Opt-in via `options.toastMessage` since not
  // every caller's handoff needs announcing.
  useEffect(() => {
    if (!cameFromPendingPersonaRef.current || !options?.toastMessage) return;
    toast.info(options.toastMessage.title, {
      description: options.toastMessage.description,
    });
    // NOTE: does not reset cameFromPendingPersonaRef here — a caller's own
    // settings-sync effect (which runs after this one mounts) may still need
    // to see it be true, to know NOT to immediately clear the persona this
    // same effect just announced via the toast. It consumes/resets the ref
    // itself once it's done checking, if it needs to at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return cameFromPendingPersonaRef;
}
