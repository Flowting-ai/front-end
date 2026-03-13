export const mergeStreamingText = (
  currentValue: string | null | undefined,
  incomingValue: string | null | undefined,
): string => {
  const current = currentValue ?? "";
  const incoming = incomingValue ?? "";

  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming === current) return current;

  // Some backends emit cumulative snapshots instead of deltas.
  if (incoming.startsWith(current)) {
    return incoming;
  }

  // Ignore exact resend of the trailing chunk.
  if (current.endsWith(incoming)) {
    return current;
  }

  const maxOverlap = Math.min(current.length, incoming.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (current.slice(-overlap) === incoming.slice(0, overlap)) {
      return `${current}${incoming.slice(overlap)}`;
    }
  }

  return `${current}${incoming}`;
};