'use client'

import dynamic from 'next/dynamic'
import type { PickerDialogProps } from './PickerDialog'

// Loaded the first time it is opened (render it only while open: `{open && <LazyPickerDialog .../>}`),
// so the composer pays nothing for the picker until someone uses it.
const PickerDialog = dynamic(() => import('./PickerDialog').then((module) => module.PickerDialog), { ssr: false, loading: () => null })

export function LazyPickerDialog(props: PickerDialogProps) {
  return <PickerDialog {...props} />
}
