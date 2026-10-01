'use client'

import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImageAddTwoIcon, RedoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { compressImageToDataUrl, MAX_AVATAR_SOURCE_BYTES } from '@/lib/compress-image'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'
import { HINT_STYLE, LABEL_STYLE } from './styles'

const AVATAR_SIZE = 65

export interface AvatarFieldProps {
  avatarUrl:    string | null
  name:         string
  onChange:     (avatarUrl: string) => void
  onRegenerate: () => void
  disabled?:    boolean
}

export function AvatarField({ avatarUrl, name, onChange, onRegenerate, disabled = false }: AvatarFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)

  const src = avatarUrl && brokenUrl !== avatarUrl ? avatarUrl : getPersonaFallbackAvatar(name || 'agent')

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file for the avatar.')
      return
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      toast.error('That image is too large. Choose one under 10 MB.')
      return
    }
    setProcessing(true)
    try {
      onChange(await compressImageToDataUrl(file, 800, 800, 0.8))
    } catch {
      toast.error('That image could not be used. Try a different one.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={LABEL_STYLE}>Avatar</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            backgroundColor: 'var(--neutral-100)',
            boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data: URL or a signed remote URL; onError fallback needs the raw element */}
          <img
            src={src}
            alt=""
            onError={() => setBrokenUrl(avatarUrl)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={processing ? <Spinner size={14} /> : <ImageAddTwoIcon size={16} />}
            disabled={disabled || processing}
            onClick={() => inputRef.current?.click()}
          >
            {processing ? 'Processing…' : 'Upload'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<RedoIcon size={16} />}
            disabled={disabled || processing}
            onClick={onRegenerate}
          >
            Regenerate
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={event => {
            const file = event.target.files?.[0]
            // Reset so picking the same file twice still fires change.
            event.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </div>
      <p style={HINT_STYLE}>Shows on the agent card, in chat and in pickers.</p>
    </div>
  )
}
