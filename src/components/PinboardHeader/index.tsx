'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchOneIcon, CancelOneIcon, CancelCircleIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Tooltip } from '@/components/Tooltip'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinboardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stretch to fill parent width instead of fixed 316px */
  fluid?: boolean
  /** Called when the X button is clicked outside of search mode */
  onClose?: () => void
  /** Called on every keystroke while the search input is open */
  onSearch?: (value: string) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export const PinboardHeader = React.forwardRef<HTMLDivElement, PinboardHeaderProps>(
  function PinboardHeader({ fluid = false, onClose, onSearch, style, ...props }, ref) {
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchValue, setSearchValue]   = useState('')

    function openSearch() {
      setIsSearchOpen(true)
    }

    function closeSearch() {
      setIsSearchOpen(false)
      setSearchValue('')
      onSearch?.('')
    }

    function handleSearchChange(value: string) {
      setSearchValue(value)
      onSearch?.(value)
    }

    return (
      <div
        ref={ref}
        style={{
          position:       'relative',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'flex-end',
          gap:            8,
          height:         58,
          paddingTop:     22,
          background:     'var(--neutral-50, #f7f2ed)',
          width:          fluid ? '100%' : 316,
          ...style,
        }}
        {...props}
      >
        {/* Title — absolutely positioned so it never affects flow width */}
        <AnimatePresence initial={false}>
          {!isSearchOpen && (
            <motion.p
              key="title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              style={{
                position:      'absolute',
                left:          0,
                top:           22,
                bottom:        0,
                margin:        0,
                display:       'flex',
                alignItems:    'center',
                fontFamily:    'var(--font-title)',
                fontWeight:    'var(--font-weight-regular)',
                fontSize:      'var(--font-size-heading)',
                lineHeight:    'var(--line-height-heading)',
                color:         'var(--neutral-700)',
                whiteSpace:    'nowrap',
                pointerEvents: 'none',
              }}
            >
              Pinboard
            </motion.p>
          )}
        </AnimatePresence>

        <Tooltip content="Search" disabled={isSearchOpen}>
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              flex:       isSearchOpen ? '1 0 0' : undefined,
              minWidth:   0,
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {!isSearchOpen ? (
                <motion.span
                  key="search-btn"
                  layout
                  initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                  exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)', transition: { type: 'spring', duration: 0.2, bounce: 0 } }}
                  style={{ display: 'inline-flex', flexShrink: 0 }}
                >
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<SearchOneIcon size={20} />}
                    aria-label="Open search"
                    onClick={openSearch}
                  />
                </motion.span>
              ) : (
              <motion.div
                key="search-input"
                initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                style={{ flex: '1 0 0', minWidth: 0 }}
              >
                <InputField
                  label="Search pins"
                  showLabel={false}
                  leftIcon={<SearchOneIcon size={16} />}
                  rightIcon={
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Close search"
                      onClick={closeSearch}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && closeSearch()}
                      className="kds-icon-in-field"
                      style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                    >
                      <CancelCircleIcon size={16} />
                    </span>
                  }
                  placeholder="Search for your pin..."
                  value={searchValue}
                  onChange={handleSearchChange}
                  fluid
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  aria-label="Search pins"
                />
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tooltip>

        {/* Cancel button — sibling of the expanding div, never inside it */}
        <Tooltip content="Close Pinboard">
          <IconButton
            variant="ghost"
            size="sm"
            icon={<CancelOneIcon size={20} />}
            aria-label="Close pinboard"
            onClick={onClose}
          />
        </Tooltip>
      </div>
    )
  },
)

PinboardHeader.displayName = 'PinboardHeader'
export default PinboardHeader
