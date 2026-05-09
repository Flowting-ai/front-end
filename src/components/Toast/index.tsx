'use client'

import * as React from 'react'
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import type { ToasterProps as SonnerToasterProps, ExternalToast, ToastT } from 'sonner'
import {
  CancelOneIcon,
  TickTwoIcon,
  CancelCircleIcon,
  InformationCircleIcon,
} from '@strange-huge/icons'
import { Spinner } from '@/components/Spinner'

export interface ToasterProps extends SonnerToasterProps {}

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

const KDS_TOAST_ICONS: SonnerToasterProps['icons'] = {
  success: <TickTwoIcon size={16} />,
  error:   <CancelCircleIcon size={16} />,
  warning: <InformationCircleIcon size={16} />,
  info:    <InformationCircleIcon size={16} />,
  loading: <Spinner size={16} />,
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
  const mergedToastOptions: SonnerToasterProps['toastOptions'] = {
    ...DEFAULT_TOAST_OPTIONS,
    ...toastOptions,
    classNames: {
      ...DEFAULT_TOAST_OPTIONS!.classNames,
      ...toastOptions?.classNames,
    },
  }

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

export const toast = sonnerToast
export type { ExternalToast, ToastT }
export default Toaster
