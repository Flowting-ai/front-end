'use client'

import React from 'react'
import { ArrowLeftOneIcon } from '@strange-huge/icons'
import { TopBarPortal } from '@/components/layout/TopBarSlots'
import { IconButton } from '@/components/ui/button'

/**
 * The page's back arrow, at the left end of the TopBar (level with the sidebar's toggle). `trailing`
 * goes to the TopBar's right end (e.g. the project page's Sharing button).
 */
export function PageBackButton({ label, onClick, trailing }: { label: string; onClick: () => void; trailing?: React.ReactNode }) {
  return (
    <>
      <TopBarPortal side="left">
        <IconButton variant="ghost" size="sm" aria-label={label} icon={<ArrowLeftOneIcon size={20} />} onClick={onClick} />
      </TopBarPortal>
      {trailing && <TopBarPortal side="right">{trailing}</TopBarPortal>}
    </>
  )
}
