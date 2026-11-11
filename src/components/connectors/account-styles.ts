import type React from 'react'

/** Spacing and text styles shared by the account detail dialog's parts. */
export const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, section: 32 } as const
export const text: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px' }
export const secondary: React.CSSProperties = { ...text, color: 'var(--color-text-muted)' }
export const label: React.CSSProperties = { ...text, fontWeight: 500 }
