'use client'

import React, { useState } from 'react'
import type { LibraryFile } from '@/lib/library/file'
import { FormatGlyph } from './FormatGlyph'

/**
 * A file's small private rendition, or its type icon when there is none. Thumbnails are short-lived
 * signed URLs, so one can expire while the list is open: a failed load falls back to the icon
 * instead of a broken image. `next/image` is not used, since it would cache and proxy a signed URL.
 */
export function FileThumb({
  file,
  width,
  height,
  className,
  glyphSize,
}: {
  file: LibraryFile
  width: number
  height: number
  className?: string
  glyphSize?: React.ComponentProps<typeof FormatGlyph>['size']
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = file.thumbnailUrl
  // Keyed on the URL, so a refetch that brings a fresh signed URL tries again.
  if (!url || url === failedUrl) return <FormatGlyph format={file.format} size={glyphSize} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailedUrl(url)}
    />
  )
}
