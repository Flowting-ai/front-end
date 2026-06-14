'use client'

import React, { useState } from 'react'
import { useOrg } from '@/context/org-context'
import { apiFetchJson } from '@/lib/api/client'
import { ORG_TEAM_OVERFLOW_ENDPOINT } from '@/lib/config'
import { toast } from 'sonner'

export interface OverflowRequestModalProps {
  teamId: string
  teamName?: string
  onClose: () => void
}

const PRESET_AMOUNTS = [100, 500, 1_000, 2_000]

export function OverflowRequestModal({ teamId, teamName, onClose }: OverflowRequestModalProps) {
  const { orgId } = useOrg()
  const [amount, setAmount]   = useState<number>(500)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setLoading(true)
    try {
      await apiFetchJson(ORG_TEAM_OVERFLOW_ENDPOINT(orgId, teamId), {
        method: 'POST',
        body:   JSON.stringify({ credits: amount }),
      })
      toast.success('Overflow request sent to workspace admin.')
      onClose()
    } catch {
      toast.error('Failed to send overflow request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request overflow credits"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          200,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width:           400,
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px' }}>
          <h2 style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 500,
            fontSize:   20,
            lineHeight: '28px',
            color:      'var(--neutral-900)',
            margin:     0,
          }}>
            Request extra credits
          </h2>
          {teamName && (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize:   14,
              color:      'var(--neutral-500)',
              margin:     '4px 0 0',
            }}>
              For team: <strong style={{ color: 'var(--neutral-700)' }}>{teamName}</strong>
            </p>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-600)',
            margin:     '0 0 16px',
          }}>
            Request additional credits from the workspace credit pool. Your admin will be notified.
          </p>

          {/* Preset amounts */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {PRESET_AMOUNTS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                style={{
                  height:          32,
                  padding:         '0 14px',
                  borderRadius:    8,
                  border:          `1px solid ${amount === preset ? 'var(--neutral-900)' : 'var(--neutral-200)'}`,
                  backgroundColor: amount === preset ? 'var(--neutral-900)' : 'transparent',
                  color:           amount === preset ? 'var(--neutral-white)' : 'var(--neutral-700)',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      500,
                  fontSize:        13,
                  cursor:          'pointer',
                  transition:      'all 0.1s',
                }}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <label
            htmlFor="overflow-amount"
            style={{
              display:      'block',
              fontFamily:   'var(--font-body)',
              fontSize:     13,
              fontWeight:   500,
              color:        'var(--neutral-700)',
              marginBottom: 6,
            }}
          >
            Credits to request
          </label>
          <input
            id="overflow-amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            style={{
              width:       '100%',
              height:      36,
              borderRadius: 8,
              border:      '1px solid var(--neutral-200)',
              padding:     '0 10px',
              fontFamily:  'var(--font-body)',
              fontSize:    14,
              color:       'var(--neutral-800)',
              boxSizing:   'border-box' as const,
              outline:     'none',
            }}
          />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height:          36,
                padding:         '0 16px',
                borderRadius:    8,
                border:          '1px solid var(--neutral-200)',
                backgroundColor: 'transparent',
                color:           'var(--neutral-700)',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        14,
                cursor:          'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || amount < 1}
              style={{
                height:          36,
                padding:         '0 16px',
                borderRadius:    8,
                border:          'none',
                backgroundColor: loading || amount < 1 ? 'var(--neutral-300)' : 'var(--neutral-900)',
                color:           'var(--neutral-white)',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        14,
                cursor:          loading || amount < 1 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

OverflowRequestModal.displayName = 'OverflowRequestModal'
export default OverflowRequestModal
