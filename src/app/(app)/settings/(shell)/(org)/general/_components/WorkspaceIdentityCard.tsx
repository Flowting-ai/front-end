'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/InputField'
import { Tooltip } from '@/components/Tooltip'
import styles from '../general.module.css'
import { CopyIcon } from './GeneralParts'
import type { WorkspaceIdentity } from './use-workspace-identity'

/** Logo, name and link at a glance, then the editable name and slug and the read-only workspace ID. */
export function WorkspaceIdentityCard({ identity }: { identity: WorkspaceIdentity }) {
  const {
    workspaceName, setWorkspaceName, slugValue, setSlugValue, orgIdValue, logoUrl, logoPreview,
    avatarUploading, logoInputRef, identityLoading, identitySaving, isEditingIdentity, isIdentityDirty,
    handlePickLogo, handleSaveIdentity, handleEditIdentity, handleCancelIdentityEdit, copyOrgId,
  } = identity
  return (
    <section className={styles.card} aria-label="Workspace">
      <div className={styles.identity}>
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
          {logoPreview ?? logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview ?? logoUrl ?? ''} alt="" />
          ) : (
            <span>{(workspaceName.trim()[0] ?? 'W').toUpperCase()}</span>
          )}
          <span className={styles.logoOverlay} aria-hidden="true">Change</span>
        </button>

        <div className={styles.who}>
          <p className={styles.name}>{workspaceName || 'Your workspace'}</p>
          <p className={styles.url}>{slugValue ? `souvenir.ai/workspace/${slugValue}` : 'No URL set'}</p>
          {isEditingIdentity && (
            <div className={styles.logoActions}>
              <Button variant="outline" size="sm" loading={avatarUploading} disabled={avatarUploading} onClick={() => logoInputRef.current?.click()}>
                {(logoPreview ?? logoUrl) ? 'Change logo' : 'Upload logo'}
              </Button>
              <span>PNG, JPG or GIF, 512×512px recommended</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {isEditingIdentity ? (
            <>
              <Button variant="ghost" size="sm" className="bg-transparent" disabled={identitySaving} onClick={handleCancelIdentityEdit}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleSaveIdentity()}
                disabled={!isIdentityDirty || identitySaving}
                loading={identitySaving}
              >
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" disabled={identityLoading} onClick={handleEditIdentity}>
              Edit workspace
            </Button>
          )}
        </div>
      </div>

      <div className={styles.fields}>
        <div className={styles.wide}>
          <InputField
            fluid
            label="Workspace name"
            value={workspaceName}
            onChange={setWorkspaceName}
            placeholder="Your workspace name"
            subtitle="Shown to everyone in the workspace and on invites"
            disabled={!isEditingIdentity}
          />
        </div>
        <InputField
          fluid
          label="Workspace URL slug"
          value={slugValue}
          onChange={setSlugValue}
          placeholder="your-workspace"
          subtitle={slugValue ? `souvenir.ai/workspace/${slugValue}` : 'Used in your workspace link'}
          disabled={!isEditingIdentity}
        />
        <InputField
          fluid
          label="Workspace ID"
          value={orgIdValue}
          disabled
          subtitle="Read-only. Support may ask for it."
          rightIcon={
            <Tooltip content="Copy ID">
              <button type="button" className={styles.copy} aria-label="Copy workspace ID" onClick={copyOrgId}>
                <CopyIcon />
              </button>
            </Tooltip>
          }
        />
      </div>
    </section>
  )
}
