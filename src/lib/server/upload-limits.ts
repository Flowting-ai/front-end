/**
 * Upload limits enforced by the chat proxy routes. They mirror the client's
 * FILE_CONSTRAINTS (hooks/use-file-upload.ts), which a crafted request skips.
 */
export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 30 * 1024 * 1024,
} as const

export interface UploadRejection {
  status: 413
  code: "payload_too_large"
  message: string
}

/** Null when the files are within limits, otherwise the 413 to return. */
export function checkUploads(files: ReadonlyArray<{ size: number }>): UploadRejection | null {
  if (files.length > UPLOAD_LIMITS.maxFiles) {
    return { status: 413, code: "payload_too_large", message: `Attach at most ${UPLOAD_LIMITS.maxFiles} files` }
  }
  if (files.some((file) => file.size > UPLOAD_LIMITS.maxFileBytes)) {
    return { status: 413, code: "payload_too_large", message: "Each file must be 30 MB or smaller" }
  }
  return null
}
