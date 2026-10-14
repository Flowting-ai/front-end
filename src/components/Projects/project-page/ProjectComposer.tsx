'use client'

import React, { useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { FolderOneIcon, GlobalSearchIcon, QuillWriteTwoIcon } from '@strange-huge/icons'
import { Chip } from '@/components/Chip'
import { ChipTooltip } from '@/components/Chip/ChipTooltip'
import { Dropdown } from '@/components/Dropdown'
import { InlineCreditNotice } from '@/components/InlineCreditNotice'
import { AgentChip } from '@/components/chat/AgentChip'
import { ChatAddMenu } from '@/components/chat/AddMenu'
import { AttachmentManager } from '@/components/chat/AttachmentManager'
import { ChatInput } from '@/components/chat/ChatInput'
import { ModelMenu, useModelButtonIcon, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useWorkspaceCreditNotice } from '@/hooks/use-workspace-credit-notice'
import { PINS_ENABLED } from '@/lib/feature-flags'
import { USE_STYLE_OPTIONS } from '@/lib/tone-options'
import type { ProjectComposerState } from './use-project-composer'

/** The "start a new chat in this project" composer, with its chips (style, folders, web search, agent). */
export function ProjectComposer({ composer, onOpenAgents }: { composer: ProjectComposerState; onOpenAgents: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [styleChipOpen, setStyleChipOpen] = useState(false)
  const { processFiles, FILE_ACCEPT } = useFileUpload()
  const { open: openModelSelector } = useModelSelectorContext()
  const modelButtonLabel = useModelButtonLabel()
  const modelButtonIcon = useModelButtonIcon()
  const { status: creditNoticeStatus, isAdmin, dismiss, goToPlans } = useWorkspaceCreditNotice()
  const { persona, styleId, webSearch } = composer
  const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === styleId) ?? null
  const folders = PINS_ENABLED ? composer.folders : []

  return (
    <div style={{ width: '100%', maxWidth: '679px', flexShrink: 0 }}>
      <AnimatePresence>
        {creditNoticeStatus && (
          <InlineCreditNotice key={creditNoticeStatus} status={creditNoticeStatus} isAdmin={isAdmin} onAdminAction={goToPlans} onDismiss={dismiss} />
        )}
      </AnimatePresence>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files)
            composer.setAttachments(prev => processFiles(files, prev))
            e.target.value = ''
          }
        }}
        style={{ display: 'none' }}
        aria-hidden
      />
      <ChatInput
        placeholder="Ask anything, or use your voice..."
        value={composer.text}
        onChange={composer.setText}
        onSend={composer.send}
        onFilePaste={(files) => composer.setAttachments(prev => processFiles(files, prev))}
        hasAttachments={composer.attachments.length > 0}
        modelName={modelButtonLabel}
        modelIcon={modelButtonIcon}
        onModelClick={persona ? undefined : (e) => openModelSelector(e.currentTarget)}
        modelMenu={persona ? undefined : <ModelMenu />}
        disabledModelSelector={!!persona}
        textareaMaxHeight="220px"
        addMenu={
          <ChatAddMenu
            webSearchEnabled={webSearch}
            onWebSearchChange={composer.setWebSearch}
            onAddFilesClick={() => fileInputRef.current?.click()}
            selectedStyleId={styleId}
            onStyleChange={composer.setStyleId}
            selectedFolders={folders}
            hidePinFolders={!PINS_ENABLED}
            onFolderToggle={(folder) => PINS_ENABLED && composer.toggleFolder(folder)}
            selectedPersonaId={persona?.id ?? null}
            onPersonaChange={composer.setPersona}
          />
        }
        chips={
          <>
            {activeStyle && (
              <Dropdown.Float
                open={styleChipOpen}
                onOpenChange={setStyleChipOpen}
                placement="top-start"
                trigger={
                  <Chip
                    label={activeStyle.label}
                    tooltip={<ChipTooltip title="Writing style" detail={{ label: 'Active', value: activeStyle.label }} lines={['Shapes the tone of replies.']} hints={['▾: change style', '×: remove']} />}
                    icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
                    onRemove={() => composer.setStyleId(null)}
                    onExpand={() => setStyleChipOpen(v => !v)}
                  />
                }
              >
                <Dropdown size="md">
                  <Dropdown.Section fluid>
                    {USE_STYLE_OPTIONS.map(opt => (
                      <Dropdown.Item
                        key={opt.id}
                        label={opt.label}
                        subLabel={opt.subLabel}
                        selected={opt.id === 'none' ? styleId === null : styleId === opt.id}
                        onClick={() => { composer.setStyleId(opt.id === 'none' ? null : opt.id); setStyleChipOpen(false) }}
                        fluid
                      />
                    ))}
                  </Dropdown.Section>
                </Dropdown>
              </Dropdown.Float>
            )}
            {folders.map(folder => (
              <Chip
                key={folder.id}
                label={folder.name}
                tooltip={<ChipTooltip title="Folder" detail={{ label: 'Active', value: folder.name }} lines={['Its pins are used as context.']} hints={['×: remove']} />}
                icon={<FolderOneIcon size={20} color="var(--chip-text)" variant="static" />}
                onRemove={() => composer.setFolders(prev => prev.filter(f => f.id !== folder.id))}
              />
            ))}
            {webSearch && (
              <Chip
                size="Medium"
                icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
                label="Web search"
                hideLabel
                tooltip={<ChipTooltip title="Web search" lines={['Searches the web for up-to-date answers.']} hints={['×: turn off']} />}
                onRemove={() => composer.setWebSearch(false)}
              />
            )}
            {persona && <AgentChip agent={persona} onRemove={() => composer.setPersona(null)} onOpenPanel={onOpenAgents} />}
          </>
        }
        attachmentsSlot={<AttachmentManager attachments={composer.attachments} onAttachmentsChange={composer.setAttachments} />}
      />
    </div>
  )
}
