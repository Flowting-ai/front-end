/**
 * Merges a streaming text delta into the accumulated content.
 *
 * Handles both delta-mode backends (sends only new chars) and snapshot-mode
 * backends (sends the full accumulated string each time).
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

  // Snapshot mode: backend resent the full string (possibly extended)
  if (incoming.startsWith(current)) return incoming

  // Resent the trailing chunk — ignore
  if (current.endsWith(incoming)) return current

  // Partial overlap: find the longest suffix-prefix match and stitch
  const maxOverlap = Math.min(current.length, incoming.length)
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (current.slice(-overlap) === incoming.slice(0, overlap)) {
      return `${current}${incoming.slice(overlap)}`
    }
  }

  return `${current}${incoming}`
}
