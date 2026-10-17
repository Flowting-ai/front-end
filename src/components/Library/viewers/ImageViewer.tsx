'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { safeAssetUrl } from '@/lib/library/viewers/safe-url'

// Taller than this many times its width: fitted by width, not height.
const TALL_RATIO = 2.5

/** An image as a plain <img> (never inline SVG, so a file's markup cannot run), fitted by default with a toggle to full size. */
export default function ImageViewer({ url, caption }: { url: string; caption?: string }) {
  const [actualSize, setActualSize] = useState(false)
  // A very tall image (a long screenshot) fitted to the screen's height is a sliver nobody can read,
  // so it fits the width instead and the page scrolls.
  const [tall, setTall] = useState(false)
  const src = safeAssetUrl(url, 'image')
  if (!src) throw new Error('image-unavailable')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <Button variant="secondary" size="sm" onClick={() => setActualSize((value) => !value)} aria-pressed={actualSize}>
        {actualSize ? 'Fit to screen' : 'Actual size'}
      </Button>
      <div className="kaya-scrollbar kaya-no-gutter" style={{ maxWidth: '100%', overflow: 'auto', borderRadius: 12, background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)' }}>
        {/* A presigned storage URL: it cannot go through the image optimiser, and the size is the file's own. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || 'Image preview'}
          decoding="async"
          onLoad={(event) => setTall(event.currentTarget.naturalHeight > event.currentTarget.naturalWidth * TALL_RATIO)}
          style={actualSize
            ? { display: 'block', maxWidth: 'none' }
            : { display: 'block', maxWidth: '100%', maxHeight: tall ? 'none' : '70vh', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}
