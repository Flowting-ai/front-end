'use client'

import React, { useRef } from 'react'
import { UserAvatar, deriveInitials } from '@/components/Avatar'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/ui/button'
import styles from '../account.module.css'
import type { ProfileForm } from './use-profile-form'

/** Profile: a header like the other cards (with Edit on the right), the photo beside the name you
 *  can change, then the details that are fixed (email, role) as read-only rows. */
export function ProfileCard({ form, role, email, fallbackName }: {
  form: ProfileForm
  role: string
  email: string
  /** The saved name, for initials while the fields are cleared. */
  fallbackName: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { values, isEditing, isSaving } = form
  const typedName = `${values.firstName} ${values.lastName}`.trim()
  const pickFile = () => fileInputRef.current?.click()

  return (
    <section className={styles.card} aria-labelledby="profile-title">
      <div className={`${styles.cardHead} ${styles.cardHeadRow}`}>
        <div style={{ minWidth: 0 }}>
          <h2 id="profile-title" className={styles.cardTitle}>Profile</h2>
          <p className={styles.cardHint}>How you appear to your team.</p>
        </div>
        <div className={styles.actions}>
          {isEditing ? (
            <>
              <Button variant="cancel" size="sm" disabled={isSaving} onClick={form.cancel}>Cancel</Button>
              <Button variant="save" size="sm" disabled={!form.isDirty || !form.isValid || isSaving} loading={isSaving} onClick={() => void form.save()}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={form.startEditing}>Edit profile</Button>
          )}
        </div>
      </div>

      <div className={styles.profile}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // allow picking the same file again
            void form.pickAvatar(file)
          }}
          style={{ display: 'none' }}
        />
        <div className={styles.avatarCol}>
          <button type="button" className={styles.avatar} disabled={!isEditing} onClick={pickFile} aria-label="Change profile picture">
            {/* Same avatar as the sidebar and account menu; while a new name is typed, its initials preview here. */}
            <UserAvatar name={fallbackName || '?'} initials={typedName ? deriveInitials(typedName) : undefined} src={values.avatar} size={72} />
            <span className={styles.avatarOverlay} aria-hidden="true">Change</span>
          </button>
          {isEditing && (
            <div className={styles.avatarActions}>
              <Button variant="outline" size="xs" onClick={pickFile}>{values.avatar ? 'Change' : 'Upload'}</Button>
              {values.avatar && <Button variant="ghost" size="xs" onClick={form.removeAvatar}>Remove</Button>}
            </div>
          )}
        </div>

        <div className={styles.fields}>
          <InputField
            fluid
            label="First name"
            value={values.firstName}
            onChange={(v) => form.setField('firstName', v)}
            placeholder="Your first name"
            subtitle={form.errors.firstName ?? 'Shown in team chats and persona attribution'}
            error={!!form.errors.firstName}
            disabled={!isEditing}
          />
          <InputField
            fluid
            label="Last name"
            value={values.lastName}
            onChange={(v) => form.setField('lastName', v)}
            placeholder="Your last name"
            subtitle={form.errors.lastName}
            error={!!form.errors.lastName}
            disabled={!isEditing}
          />
        </div>
      </div>

      {/* Never editable here, so shown as facts rather than greyed-out inputs. */}
      <dl className={styles.details}>
        <div className={styles.detailRow}>
          <dt>
            <span className={styles.detailLabel}>Email address</span>
            <span className={styles.detailHint}>Used for billing and notifications</span>
          </dt>
          <dd className={styles.detailValue}>{email}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt>
            <span className={styles.detailLabel}>Role</span>
            <span className={styles.detailHint}>Set during onboarding</span>
          </dt>
          <dd className={styles.detailValue}>{role || '—'}</dd>
        </div>
      </dl>
    </section>
  )
}
