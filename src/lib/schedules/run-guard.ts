/**
 * Lets one "Run now" through at a time. The button is disabled only after a re-render, so two clicks in one
 * frame both reached the mutation and sent two POSTs. `tryStart` answers synchronously; `done` frees it.
 */
export function createRunGuard() {
  let inFlight = false
  return {
    tryStart(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    done(): void {
      inFlight = false
    },
  }
}
