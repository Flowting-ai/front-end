/**
 * Copies a share link and reports the real result, instead of announcing
 * "Link copied" even when the clipboard refused (no permission, insecure
 * context). Callers show the link itself on failure so it can be copied by hand.
 */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator !== "undefined" ? navigator.clipboard : undefined,
): Promise<boolean> {
  if (!clipboard?.writeText) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export interface CopyNotifier {
  success: (message: string) => void
  error: (message: string, options: { description: string; duration: number }) => void
}

/** Copy, then toast the outcome; on failure the toast carries the link for a manual copy. */
export async function copyShareLink(url: string, notify: CopyNotifier, clipboard?: Pick<Clipboard, "writeText">): Promise<boolean> {
  const ok = await copyText(url, clipboard ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined))
  if (ok) notify.success("Link copied")
  else notify.error("Couldn't copy the link. Copy it from here:", { description: url, duration: 15_000 })
  return ok
}
