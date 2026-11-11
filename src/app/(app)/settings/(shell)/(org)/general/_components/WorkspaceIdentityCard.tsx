'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { ViewIcon, ViewOffSlashIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/InputField'
import { Tooltip } from '@/components/Tooltip'
import styles from '../general.module.css'
import { CopyIcon } from './GeneralParts'
import type { WorkspaceIdentity } from './use-workspace-identity'

/**
 * The workspace at a glance: logo, name and link (with copy) in the header, the workspace ID in a
 * footer strip. "Edit workspace" opens the name and link as a form under the header and lets the
 * logo be changed.
 */
export function WorkspaceIdentityCard({ identity }: { identity: WorkspaceIdentity }) {
  const {
    workspaceName, setWorkspaceName, slugValue, setSlugValue, orgIdValue, logoUrl, logoPreview,
    avatarUploading, logoInputRef, identityLoading, identitySaving, isEditingIdentity, isIdentityDirty,
    handlePickLogo, handleSaveIdentity, handleEditIdentity, handleCancelIdentityEdit, copyOrgId,
  } = identity
  const link = slugValue ? `souvenir.ai/workspace/${slugValue}` : ''
  // The ID is hidden until asked for (first 8 characters show, so it can still be recognised).
  const [idShown, setIdShown] = useState(false)
  const shownId = idShown || !orgIdValue ? orgIdValue : `${orgIdValue.slice(0, 8)}${'•'.repeat(12)}`
  const logo = logoPreview ?? logoUrl
  const copyLink = () => {
    void navigator.clipboard.writeText(`https://${link}`)
    toast.success('Link copied')
  }
  const copyButton = (label: string, onClick: () => void) => (
    <Tooltip content={label}>
      <button type="button" className={styles.copy} aria-label={label} onClick={onClick}>
        <CopyIcon />
      </button>
    </Tooltip>
  )

  return (
    <section className={styles.card} aria-label="Workspace">
      {/* ── Header: logo, name, link ── */}
      <div className={styles.hero}>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void handlePickLogo(f); e.target.value = '' }}
        />
        <button
          type="button"
          className={styles.logo}
          disabled={!isEditingIdentity || avatarUploading}
          onClick={() => logoInputRef.current?.click()}
          aria-label="Change workspace logo"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" />
          ) : (
            <span>{(workspaceName.trim()[0] ?? 'W').toUpperCase()}</span>
          )}
          <span className={styles.logoOverlay} aria-hidden="true">Change</span>
        </button>

        <div className={styles.heroText}>
          <p className={styles.heroName}>{workspaceName || 'Your workspace'}</p>
          {isEditingIdentity ? (
            <div className={styles.heroLogoActions}>
              <Button variant="outline" size="sm" loading={avatarUploading} disabled={avatarUploading} onClick={() => logoInputRef.current?.click()}>
                {logo ? 'Change logo' : 'Upload logo'}
              </Button>
              <span>Square PNG or JPG, 512px</span>
            </div>
          ) : (
            <div className={styles.heroLink}>
              <span className={styles.value}>{link || 'No link set'}</span>
              {link && copyButton('Copy link', copyLink)}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {isEditingIdentity ? (
            <>
              <Button variant="cancel" size="sm" disabled={identitySaving} onClick={handleCancelIdentityEdit}>
                Cancel
              </Button>
              <Button
                variant="save"
                size="sm"
                onClick={() => void handleSaveIdentity()}
                disabled={!isIdentityDirty || identitySaving}
                loading={identitySaving}
              >
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" disabled={identityLoading} onClick={handleEditIdentity}>
              Edit workspace
            </Button>
          )}
        </div>
      </div>

      {/* ── Edit form: name and link ── */}
      {isEditingIdentity && (
        <div className={styles.editForm}>
          <InputField
            fluid
            label="Workspace name"
            value={workspaceName}
            onChange={setWorkspaceName}
            placeholder="Your workspace name"
            subtitle="Shown in the workspace and on invites"
          />
          <div className={styles.linkField}>
            <span className={styles.linkFieldLabel}>Workspace link</span>
            <div className={styles.slugField}>
              <span className={styles.slugPrefix}>souvenir.ai/workspace/</span>
              <InputField fluid label="Workspace link" showLabel={false} value={slugValue} onChange={setSlugValue} placeholder="your-workspace" />
            </div>
            <span className={styles.linkFieldHint}>Where members open the workspace</span>
          </div>
        </div>
      )}

      {/* ── Footer strip: the ID support asks for ── */}
      <div className={styles.idStrip}>
        <span className={styles.idLabel}>Workspace ID</span>
        <span className={`${styles.value} ${styles.mono}`}>{shownId || '—'}</span>
        {orgIdValue && (
          <Tooltip content={idShown ? 'Hide ID' : 'Show ID'}>
            <button
              type="button"
              className={styles.copy}
              aria-label={idShown ? 'Hide workspace ID' : 'Show workspace ID'}
              aria-pressed={idShown}
              onClick={() => setIdShown(shown => !shown)}
            >
              {idShown ? <ViewOffSlashIcon size={16} /> : <ViewIcon size={16} />}
            </button>
          </Tooltip>
        )}
        {orgIdValue && copyButton('Copy workspace ID', copyOrgId)}
      </div>
    </section>
  )
}
