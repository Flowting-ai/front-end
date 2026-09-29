import type React from 'react'

// Strips native <button> chrome so a real button can drop into a flex slot
// looking exactly like the role="button" span/div it replaces — buttons are
// the semantically-correct, keyboard-accessible-for-free choice (native
// Enter/Space activation, no manual onKeyDown or tabIndex needed), but bring
// unwanted default appearance (border, background, padding, font) that has
// to be reset explicitly.
export const RESET_BUTTON_STYLE: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}
