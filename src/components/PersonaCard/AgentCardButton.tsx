'use client'

import React from 'react'
import { Button, type ButtonProps } from '@/components/Button'

// The button on every agent card: a white pill with dark text in both light and dark mode, like the
// reference card's "Add to Grok Bot". It is the secondary button with its colour tokens pinned to
// white (they would otherwise follow the theme and turn dark in dark mode), scoped to this button.

const WHITE_BUTTON: React.CSSProperties = {
  display: 'inline-flex',
  // CSS custom properties are not in React.CSSProperties; they are set for the Button inside only.
  ...({
    '--button-secondary-bg':            '#ffffff',
    '--button-secondary-bg-hover':      '#f1efec',
    '--button-secondary-text':          '#1c1c1c',
    '--button-secondary-text-disabled': 'rgba(28, 28, 28, 0.45)',
  } as React.CSSProperties),
}

export function AgentCardButton(props: Omit<ButtonProps, 'variant'>) {
  return (
    <span style={WHITE_BUTTON}>
      <Button {...props} variant="secondary" />
    </span>
  )
}
