/**
 * Merges a streaming text delta into the accumulated content.
 *
 * Handles both delta-mode (sends only new chars) and snapshot-mode
 * (sends the full accumulated string each time) backends.
 */
export const mergeStreamingText = (
  currentValue: string | null | undefined,
  incomingValue: string | null | undefined,
): string => {
  const current = currentValue ?? ""
  const incoming = incomingValue ?? ""

  if (!incoming) return current
  if (!current) return incoming
  if (incoming === current) return current

  // Snapshot mode: backend resent the full accumulated string, now longer
  if (incoming.length > current.length && incoming.startsWith(current)) return incoming

  // Delta mode: always append
  return `${current}${incoming}`
}
