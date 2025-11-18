"use client";

export type PinAccent = "lemon" | "sky" | "blush" | "mint";
export type PinTag = "Tone" | "Actions" | "Notes" | "Formats";
export const PIN_TAGS: PinTag[] = ["Tone", "Actions", "Notes", "Formats"];
export const PIN_TAG_DESCRIPTIONS: Record<PinTag, string> = {
  Tone: "Communication cues that shape how every response should sound.",
  Actions: "Step-by-step flows and rituals the AI should follow automatically.",
  Notes: "Reusable facts, constraints, or business context worth remembering.",
  Formats: "Reusable structures like briefs, bug reports, or outlines.",
};
export const PIN_TAG_ACCENTS: Record<PinTag, PinAccent> = {
  Tone: "lemon",
  Actions: "sky",
  Notes: "blush",
  Formats: "mint",
};

export interface Pin {
  id: string;
  title: string;
  type: string;
  content: string;
  preview?: string;
  tag: PinTag;
  accentColor?: PinAccent;
  isFavorite?: boolean;
  updatedAt?: string;
  chatId?: string;
}

export interface PinDraft extends Omit<Pin, "id" | "tag"> {
  id?: string;
  tag?: PinTag;
}
