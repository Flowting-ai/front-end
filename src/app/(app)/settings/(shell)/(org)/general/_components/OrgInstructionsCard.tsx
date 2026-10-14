'use client'

import React from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import styles from '../general.module.css'
import { INSTRUCTION_STARTERS } from './GeneralParts'
import type { OrgSettings } from './use-org-settings'

/** The instructions every AI answer in the workspace follows, with one-click starters. Capped at 3,000 characters. */
export function OrgInstructionsCard({ settings }: { settings: OrgSettings }) {
  const { aiInstructions, setAiInstructions, settingsLoading, settingsSaving, clearingInstructions, handleClearInstructions, handleSaveInstructions } = settings
  return (
    <section className={styles.card} aria-labelledby="org-instructions-title">
      <div className={styles.cardHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="org-instructions-title" className={styles.cardTitle}>Organization-level AI instructions</h2>
          <p className={styles.cardHint}>Applied to every AI answer in this workspace. Members can add personal instructions on top.</p>
        </div>
        <Badge label="Overrides personal" color="Yellow" />
      </div>

      <div className={styles.editor} style={{ opacity: settingsLoading ? 0.6 : 1 }}>
        <textarea
          className={styles.textarea}
          aria-labelledby="org-instructions-title"
          value={aiInstructions}
          onChange={e => setAiInstructions(e.target.value.slice(0, 3000))}
          placeholder="Tell Souvenir how everyone's answers should read, e.g. which sources to trust, the tone to use, or what to always include."
        />
        <div className={styles.suggestions}>
          <span>Add a starter:</span>
          {INSTRUCTION_STARTERS.map(starter => (
            <button
              key={starter}
              type="button"
              className={styles.suggestion}
              disabled={aiInstructions.includes(starter) || aiInstructions.length + starter.length + 1 > 3000}
              onClick={() => setAiInstructions(current => (current.trim() ? `${current.trimEnd()}\n${starter}` : starter))}
            >
              + {starter}
            </button>
          ))}
        </div>
        <div className={styles.editorMeta}>
          <span>Changes reach active sessions within an hour.</span>
          <span className={styles.counter}>{aiInstructions.length.toLocaleString()} / 3,000</span>
        </div>
      </div>

      <div className={styles.footer}>
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
          disabled={settingsSaving || clearingInstructions || settingsLoading}
        >
          Save instructions
        </Button>
      </div>
    </section>
  )
}
