// Keyboard focus in the virtualised file table. Only the visible rows are in the DOM, so a focused row
// that scrolls away would unmount and drop focus to <body>. The table keeps the focused row rendered
// (withFocusedRow) and moves between rows with the arrow keys (nextRowIndex), rendering the target
// row before it is focused.

/** The virtualiser's visible indexes plus the focused row, kept in order. A focused index outside
 *  0..count-1 (the list shrank under it) is ignored, so the virtualiser never gets a missing row. */
export function withFocusedRow(indexes: number[], focused: number | null, count = Infinity): number[] {
  if (focused === null || focused < 0 || focused >= count || indexes.includes(focused)) return indexes;
  return [...indexes, focused].sort((a, b) => a - b);
}

/** Where a key moves focus from `current` in a list of `count` rows, or null if the key is not a row move. */
export function nextRowIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
      return Math.min(current + 1, count - 1);
    case "ArrowUp":
      return Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
