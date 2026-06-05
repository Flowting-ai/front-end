'use client'

import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowDownOneIcon, CancelOneIcon } from '@strange-huge/icons'
import type { WorkspaceRole } from '@/types/teams'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'

interface AppInviteModalProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (email: string, role: WorkspaceRole) => void
}

const ROLES: WorkspaceRole[] = ['member', 'editor', 'admin']

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
  member: 'Member',
}

const menuItemStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          8,
  padding:      '6px 10px',
  borderRadius: 8,
  cursor:       'pointer',
  fontFamily:   'var(--font-body)',
  fontWeight:   400,
  fontSize:     13,
  lineHeight:   '20px',
  color:        'var(--neutral-700)',
  outline:      'none',
  userSelect:   'none',
}

export function AppInviteModal({ isOpen, onClose, onInvite }: AppInviteModalProps) {
  const [email,    setEmail]    = useState('')
  const [role,     setRole]     = useState<WorkspaceRole>('member')
  const [roleOpen, setRoleOpen] = useState(false)

  const handleSubmit = () => {
    if (!email.trim()) return
    onInvite(email.trim(), role)
    setEmail('')
    setRole('member')
    onClose()
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(18,12,8,0.52)',
            zIndex:          100,
          }}
        />
        <Dialog.Content
          style={{
            position:        'fixed',
            top:             '50%',
            left:            '50%',
            transform:       'translate(-50%, -50%)',
            width:           484,
            backgroundColor: 'var(--neutral-50)',
            borderRadius:    20,
            boxShadow:       '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.10)',
            padding:         8,
            zIndex:          101,
            outline:         'none',
          }}
        >
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        16,
              borderRadius:   20,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, width: 436 }}>
              <div
                style={{
                  width:         '100%',
                  padding:       '12px 12px 24px',
                  borderBottom:  '1px solid var(--neutral-100)',
                  overflow:      'hidden',
                  boxSizing:     'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Dialog.Title
                    style={{
                      width:        384,
                      fontFamily:   'var(--font-title)',
                      fontWeight:   400,
                      fontSize:     24,
                      lineHeight:   '32px',
                      color:        'var(--neutral-900)',
                      margin:       0,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    Invite member
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label="Close invite member dialog"
                      icon={<CancelOneIcon size={20} />}
                    />
                  </Dialog.Close>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
                <InputField
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Teammember@company.com"
                  aria-label="Team member email"
                />

                <DropdownMenu.Root open={roleOpen} onOpenChange={setRoleOpen}>
                  <DropdownMenu.Trigger asChild>
                    <Button size="sm" variant="secondary" rightIcon={<ArrowDownOneIcon size={16} />}>
                      {ROLE_LABEL[role]}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                      style={{
                        backgroundColor: 'white',
                        borderRadius:    10,
                        padding:         4,
                        boxShadow:       '0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
                        zIndex:          110,
                        minWidth:        112,
                        outline:         'none',
                      }}
                    >
                      {ROLES.map(r => (
                        <DropdownMenu.Item
                          key={r}
                          style={menuItemStyle}
                          onSelect={() => setRole(r)}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          {ROLE_LABEL[r]}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="default" disabled={!email.trim()} onClick={handleSubmit}>
                  Send Invite
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
