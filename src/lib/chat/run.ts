import { z } from "zod"

// A chat turn's run, from its first stretch of work to its end. The backend keeps it on the turn's
// message and sends it with the history (services/chat/run.py RunView).
//
// running:  the agent is working; the reply is read from GET /chats/{id}/stream.
// waiting:  the agent has left and a card is still open; answering it takes the same run back up.
// failed:   an error, or the worker died part-way.

export const runSchema = z.object({
  id:        z.string(),
  status:    z.enum(["running", "waiting", "finished", "stopped", "failed"]),
  /** Stretches the agent worked: one, plus one for each answer it went on from. */
  segments:  z.number(),
  startedAt: z.string(),
  endedAt:   z.string().nullish(),
})

export type Run = z.infer<typeof runSchema>

/** The run on a history row, or undefined for a turn from before runs were kept (or a malformed one). */
export function parseRun(raw: unknown): Run | undefined {
  const parsed = runSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
