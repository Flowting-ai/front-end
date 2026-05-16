'use client'

/**
 * Toast - a thin KDS wrapper around `sonner`.
 *
 * Re-exports `Toaster` (the host element you mount once near the app root) and
 * the imperative `toast` function (call from anywhere to push a notification).
 *
 * Theming is wired through CSS custom properties in `globals.css` - every
 * sonner variable (`--normal-bg`, `--success-bg`, etc.) maps to a KDS semantic
 * token (`--toast-bg`, `--toast-success-bg`, …) which in turn references a
 * primitive in `aliases.css`. To restyle a state, change the alias - never
 * sonner's variable directly.
 *
 * Mount once:
 * ```tsx
 * import { Toaster } from '@/components/Toast'
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return <html><body>{children}<Toaster /></body></html>
 * }
 * ```
 *
 * Fire from anywhere:
 * ```tsx
 * import { toast } from '@/components/Toast'
 *
 * toast.success('Saved')
 * toast.error('Could not save', { description: 'Network unreachable' })
 * toast.promise(savePin(), { loading: 'Saving…', success: 'Saved', error: 'Save failed' })
 * ```
 */

import * as React from 'react'
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import type { ToasterProps as SonnerToasterProps, ExternalToast, ToastT } from 'sonner'
import {
  CancelOneIcon,
  CheckmarkCircleTwoIcon,
  AlertCircleIcon,
  AlertTwoIcon,
  InformationCircleIcon,
} from '@strange-huge/icons'
import { Spinner } from '@/components/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToasterProps extends SonnerToasterProps {}

// ── Default class hooks ──────────────────────────────────────────────────────
// All KDS-specific styling lives in `globals.css` keyed off these classNames.
// Marker `data-kds-toaster` scopes the CSS-variable overrides so a sonner
// instance from a non-KDS surface won't accidentally inherit them.

const DEFAULT_TOAST_OPTIONS: SonnerToasterProps['toastOptions'] = {
  classNames: {
    toast:        'kds-toast',
    title:        'kds-toast__title',
    description:  'kds-toast__description',
    actionButton: 'kds-toast__action',
    cancelButton: 'kds-toast__cancel',
    closeButton:  'kds-toast__close',
    icon:         'kds-toast__icon',
    loader:       'kds-toast__loader',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Mount once near the app root. Forwards every sonner prop and merges KDS
 * defaults for `toastOptions.classNames`.
 *
 * KDS defaults: `richColors`, `closeButton`, `position="bottom-right"`,
 * `duration={4500}`. Override any of them by passing the prop directly.
 */
// KDS-faithful icon overrides for sonner's built-in slots.
//
// All glyphs come from `@strange-huge/icons` per the KDS icon-usage rule -
// inline SVG is never substituted. Sizes match sonner's 16 px icon slot
// (toasts use the small variant) and the 18 px close-button slot.
//
//   success → CheckmarkCircleTwoIcon  (Figma `checkmark-circle-02#`)
//   error   → AlertCircleIcon         (Figma `alert-circle#`)
//   warning → AlertTwoIcon            (Figma `alert-02#`)
//   info    → InformationCircleIcon   (Figma `information-circle#`)
//   loading → KDS Spinner             (lifted from `IconButton`'s spinner)
//   close   → CancelOneIcon           (the X glyph used elsewhere in KDS)
const KDS_TOAST_ICONS: SonnerToasterProps['icons'] = {
  success: <CheckmarkCircleTwoIcon size={16} />,
  error:   <AlertCircleIcon size={16} />,
  warning: <AlertTwoIcon size={16} />,
  info:    <InformationCircleIcon size={16} />,
  loading: <Spinner size={16} />,
  // Inner glyph for sonner's close button. Size 18 matches IconButton xs
  // (the smallest IconButton variant) so the visual aligns 1:1.
  close:   <CancelOneIcon size={18} />,
}

export function Toaster({
  position    = 'bottom-right',
  duration    = 4500,
  richColors  = true,
  closeButton = true,
  toastOptions,
  icons,
  ...rest
}: ToasterProps) {
  // Merge KDS default classNames with any consumer-provided ones.
  const mergedToastOptions: SonnerToasterProps['toastOptions'] = {
    ...DEFAULT_TOAST_OPTIONS,
    ...toastOptions,
    classNames: {
      ...DEFAULT_TOAST_OPTIONS!.classNames,
      ...toastOptions?.classNames,
    },
  }

  // Merge KDS default icons with any consumer-provided overrides.
  const mergedIcons: SonnerToasterProps['icons'] = {
    ...KDS_TOAST_ICONS,
    ...icons,
  }

  return (
    <SonnerToaster
      position={position}
      duration={duration}
      richColors={richColors}
      closeButton={closeButton}
      toastOptions={mergedToastOptions}
      icons={mergedIcons}
      {...rest}
    />
  )
}

Toaster.displayName = 'Toaster'

// ── Imperative API ────────────────────────────────────────────────────────────

export const toast = sonnerToast
export type { ExternalToast, ToastT }
export default Toaster
