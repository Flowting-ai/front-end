'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import styles from '../general.module.css'
import { INSTRUCTION_STARTERS } from './GeneralParts'
import type { OrgSettings } from './use-org-settings'

const LIMIT = 3000

/**
 * The instructions every AI answer in the workspace follows: a status chip (Active / Not set), one
 * editor box with its starters and counter along the bottom, and Clear / Save. Capped at 3,000 characters.
 */
export function OrgInstructionsCard({ settings }: { settings: OrgSettings }) {
  const { aiInstructions, setAiInstructions, instructionsDirty, hasSavedInstructions, settingsLoading, settingsSaving, clearingInstructions, handleClearInstructions, handleSaveInstructions } = settings
  return (
    <section className={styles.card} aria-labelledby="org-instructions-title">
      <div className={styles.cardHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="org-instructions-title" className={styles.cardTitle}>AI instructions</h2>
          <p className={styles.cardHint}>Every answer in this workspace follows these, ahead of members&apos; own instructions.</p>
        </div>
        <span className={hasSavedInstructions ? styles.statusOn : styles.statusOff}>
          <span aria-hidden className={styles.statusDot} />
          {hasSavedInstructions ? 'Active' : 'Not set'}
        </span>
      </div>

      <div className={styles.editorWrap} style={{ opacity: settingsLoading ? 0.6 : 1 }}>
        <div className={styles.editorBox}>
          <textarea
            className={styles.textarea}
            aria-labelledby="org-instructions-title"
            value={aiInstructions}
            onChange={e => setAiInstructions(e.target.value.slice(0, LIMIT))}
            placeholder="e.g. Cite sources for facts. Keep answers short and in plain English. Use our product names exactly."
          />
          <div className={styles.editorBar}>
            <div className={styles.suggestions}>
              {INSTRUCTION_STARTERS.map(starter => (
                <button
                  key={starter}
                  type="button"
                  className={styles.suggestion}
                  disabled={aiInstructions.includes(starter) || aiInstructions.length + starter.length + 1 > LIMIT}
                  onClick={() => setAiInstructions(current => (current.trim() ? `${current.trimEnd()}\n${starter}` : starter))}
                >
                  + {starter}
                </button>
              ))}
            </div>
            <span className={styles.counter}>{aiInstructions.length.toLocaleString()} / {LIMIT.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerNote}>Changes reach active chats within an hour.</span>
        <Button
          variant="ghost"
          size="sm"
          className="bg-transparent"
          onClick={handleClearInstructions}
          loading={clearingInstructions}
          disabled={!aiInstructions || settingsSaving || clearingInstructions || settingsLoading}
        >
          Clear
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSaveInstructions}
          loading={settingsSaving}
          disabled={!instructionsDirty || settingsSaving || clearingInstructions || settingsLoading}
        >
          Save instructions
        </Button>
      </div>
    </section>
  )
}
