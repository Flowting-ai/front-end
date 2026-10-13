// Two small rules about Admin settings changes, kept pure so they can be tested:
//  1. Two Admins edit at once: the later write wins, and the Admin who was overwritten is told who
//     changed it ("Changed by Priya just now") when they next see the setting.
//  2. A member sees a one-time notice that an Admin changed Library settings, until they dismiss it.

import { sanitizeDisplayText } from "./format";
import type { Person } from "./schemas";

export type ForeignChange = { by: string };

/**
 * `knownVersion` is the version this browser last saw or wrote. When the settings now carry a newer
 * version written by someone else, report who. Returns null for our own writes and for first loads.
 */
export function detectForeignChange(
  knownVersion: number | null,
  current: { version: number; updatedBy?: Person },
  viewerId: string | undefined,
): ForeignChange | null {
  if (knownVersion === null || current.version <= knownVersion) return null;
  if (!current.updatedBy || current.updatedBy.id === viewerId) return null;
  return { by: sanitizeDisplayText(current.updatedBy.name) || "another Admin" };
}

/** Show the member notice when the settings changed after the last time they dismissed it. */
export function shouldShowSettingsNotice(changedAt: string | undefined, seenAt: string | null): boolean {
  if (!changedAt) return false;
  const changed = Date.parse(changedAt);
  if (Number.isNaN(changed)) return false;
  if (!seenAt) return true;
  const seen = Date.parse(seenAt);
  return Number.isNaN(seen) || changed > seen;
}

// ── What changed (the lines the notice lists) ────────────────────────────────

export type SettingsChange = { key: string; at: string; text: string };

type AdminFields = { defaultAutoSave: "always" | "ask" | "never"; forceAutoSaveOff: boolean; aiReferenceEnabled: boolean };

const AUTO_SAVE_WORDS: Record<AdminFields["defaultAutoSave"], string> = { always: "Always", ask: "Ask each time", never: "Never" };

/** One line per Admin setting that actually changed, in the prototype's words. */
export function settingsChangeLines(before: AdminFields, patch: Partial<AdminFields>, at: string): SettingsChange[] {
  const out: SettingsChange[] = [];
  if (patch.defaultAutoSave && patch.defaultAutoSave !== before.defaultAutoSave) {
    out.push({ key: "auto-save", at, text: `Auto-save default is now ${AUTO_SAVE_WORDS[patch.defaultAutoSave]}.` });
  }
  if (patch.forceAutoSaveOff !== undefined && patch.forceAutoSaveOff !== before.forceAutoSaveOff) {
    out.push({ key: "force-off", at, text: patch.forceAutoSaveOff ? "Your Admin has turned auto-save off." : "Auto-save follows your setting again." });
  }
  if (patch.aiReferenceEnabled !== undefined && patch.aiReferenceEnabled !== before.aiReferenceEnabled) {
    out.push({ key: "ai-reference", at, text: patch.aiReferenceEnabled ? "Souvenir can search Library again." : "Souvenir no longer searches Library in answers." });
  }
  return out;
}

/** Adds new lines; a newer line about the same setting replaces the older one. */
export function mergeChanges(existing: SettingsChange[], added: SettingsChange[]): SettingsChange[] {
  const keys = new Set(added.map((change) => change.key));
  return [...existing.filter((change) => !keys.has(change.key)), ...added];
}

/** The lines the notice lists: changes after the last dismissal, the latest three. */
export function unseenChanges(changes: SettingsChange[] | undefined, seenAt: string | null): SettingsChange[] {
  const seen = seenAt ? Date.parse(seenAt) : Number.NaN;
  const unseen = (changes ?? []).filter((change) => Number.isNaN(seen) || Date.parse(change.at) > seen);
  return unseen.slice(-3);
}

// ── Storage (a per-person convenience, never required) ───────────────────────

export function readSeen(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSeen(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the notice just shows again next time.
  }
}
