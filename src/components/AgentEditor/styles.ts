import type { CSSProperties } from 'react'

// Shared look for the agent editor surfaces — matches the field treatment used
// across the app's forms (white box, 10px radius, hairline ring).

export const LABEL_STYLE: CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   14,
  lineHeight: '20px',
  color:      'var(--neutral-800)',
}

export const HINT_STYLE: CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   12,
  lineHeight: '16px',
  color:      'var(--neutral-600)',
}

export const BOX_STYLE: CSSProperties = {
  backgroundColor: 'var(--neutral-white)',
  borderRadius:    10,
  boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
}

export const INPUT_STYLE: CSSProperties = {
  width:      '100%',
  fontFamily: 'var(--font-body)',
  fontSize:   14,
  lineHeight: '22px',
  color:      'var(--neutral-900)',
  background: 'transparent',
  border:     'none',
  outline:    'none',
}

export const SECTION_TITLE_STYLE: CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-title)',
  fontWeight: 400,
  fontSize:   18,
  lineHeight: '24px',
  color:      'var(--neutral-900)',
}
