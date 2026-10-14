/**
 * Runs once when a server instance starts (Next.js instrumentation). Logs a
 * single structured line if required configuration is missing or malformed,
 * so a bad deploy shows up in the logs at boot rather than as a confusing
 * failure on the first request. Names only, never values.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { checkServerEnv } = await import("@/lib/server/env")
  const report = checkServerEnv()
  if (report.ok) return
  const { logger } = await import("@/lib/logger")
  logger.event("config_invalid", { missing: report.missing, invalid: report.invalid }, "error")
}
