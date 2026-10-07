/**
 * Appends a streaming text delta to the accumulated content.
 *
 * The backend streams deltas only (each event carries just the new chars), so
 * this is plain concatenation. Never dedupe: a delta that repeats the text so
 * far ("ha" + "ha") or extends it ("a" + "ab") is genuine new content.
 */
export const mergeStreamingText = (
  currentValue: string | null | undefined,
  incomingValue: string | null | undefined,
): string => `${currentValue ?? ""}${incomingValue ?? ""}`
