'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/Button'

interface CancelCreationModalProps {
  onCancel: () => void
  onKeep:   () => void
}

export default function CancelCreationModal({ onCancel, onKeep }: CancelCreationModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onKeep()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cancel agent creation"
      onClick={e => { if (e.target === e.currentTarget) onKeep() }}
      style={{
        position:            'fixed',
        inset:               0,
        backgroundColor:     'rgba(18,12,8,0.5)',
        backdropFilter:      'blur(2px)',
        WebkitBackdropFilter:'blur(2px)',
        display:             'flex',
        alignItems:          'center',
        justifyContent:      'center',
        zIndex:              999,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--neutral-white)',
          borderRadius:    20,
          padding:         '28px 28px 24px',
          width:           380,
          maxWidth:        'calc(100vw - 32px)',
          display:         'flex',
          flexDirection:   'column',
          gap:             20,
          boxShadow:       '0px 20px 40px 0px rgba(18,12,8,0.18), 0px 0px 0px 1px rgba(59,54,50,0.1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 22, lineHeight: '30px', color: '#1a1916', margin: 0 }}>
            Cancel creation?
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
            Your progress will be lost. This action cannot be undone.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={onKeep}>
            Keep creating
          </Button>
          <Button variant="danger" size="sm" onClick={onCancel}>
            Yes, cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
