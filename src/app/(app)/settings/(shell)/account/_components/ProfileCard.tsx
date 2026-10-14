'use client'

import React, { useRef } from 'react'
import { Badge } from '@/components/Badge'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/ui/button'
import styles from '../account.module.css'
import type { ProfileForm } from './use-profile-form'

/** Who you are at a glance (picture, name, role, email), then the editable details. */
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
  const fullName = typedName || 'Your name'
  const initials = (typedName || fallbackName).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const pickFile = () => fileInputRef.current?.click()

  return (
    <section className={styles.card} aria-label="Profile">
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
        <button type="button" className={styles.avatar} disabled={!isEditing} onClick={pickFile} aria-label="Change profile picture">
          {values.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied data-URL avatar, not a static asset
            <img alt="" src={values.avatar} />
          ) : (
            <span>{initials || '?'}</span>
          )}
          <span className={styles.avatarOverlay} aria-hidden="true">Change</span>
        </button>

        <div className={styles.identity}>
          <p className={styles.name}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</span>
            {role && <Badge label={role} color="Neutral" />}
          </p>
          <p className={styles.email}>{email}</p>
          {isEditing && (
            <div className={styles.avatarActions}>
              <Button variant="outline" size="sm" onClick={pickFile}>{values.avatar ? 'Change photo' : 'Upload photo'}</Button>
              {values.avatar && <Button variant="ghost" size="sm" className="bg-transparent" onClick={form.removeAvatar}>Remove</Button>}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" className="bg-transparent" disabled={isSaving} onClick={form.cancel}>Cancel</Button>
              <Button variant="default" size="sm" disabled={!form.isDirty || !form.isValid || isSaving} loading={isSaving} onClick={() => void form.save()}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={form.startEditing}>Edit profile</Button>
          )}
        </div>
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
        <InputField fluid label="Role" value={role} disabled subtitle="Set during onboarding" />
        <InputField fluid label="Email address" value={email} disabled subtitle="Used for billing and notifications" />
      </div>
    </section>
  )
}
