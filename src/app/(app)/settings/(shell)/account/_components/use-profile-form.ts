'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNavGuard } from '@/context/nav-guard-context'
import { useZodForm } from '@/hooks/use-zod-form'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { currentUser } from '@/lib/api/current-user'
import { saveUser } from '@/lib/api/user'
import { MAX_UPLOAD_BYTES, fileToAvatarDataUrl } from './avatar'

export const MAX_NAME_LENGTH = 100

export interface ProfileValues extends Record<string, unknown> {
  firstName: string
  lastName: string
  /** A data URL, or null for no picture. */
  avatar: string | null
}

/** The profile form; the parsed values are what Save sends. */
export const profileSchema = z.object({
  firstName: z.string().trim().max(MAX_NAME_LENGTH, `Use ${MAX_NAME_LENGTH} characters or fewer`),
  lastName: z.string().trim().max(MAX_NAME_LENGTH, `Use ${MAX_NAME_LENGTH} characters or fewer`),
  avatar: z.string().nullable(),
})

/** What changed against the saved profile, compared trimmed, as the backend stores names. */
export function profileChanges(base: ProfileValues, values: ProfileValues) {
  const nameChanged = values.firstName.trim() !== base.firstName.trim() || values.lastName.trim() !== base.lastName.trim()
  const avatarChanged = (values.avatar ?? '') !== (base.avatar ?? '')
  return { nameChanged, avatarChanged, isDirty: nameChanged || avatarChanged }
}

/**
 * The editable profile card: name and picture, staged locally until Save. Unsaved changes feed the
 * app-wide navigation guard (both sidebars ask before leaving) and the browser's close/refresh
 * prompt; the guard's "Save" runs the same save.
 */
export function useProfileForm(base: ProfileValues) {
  const form = useZodForm<ProfileValues, z.infer<typeof profileSchema>>(profileSchema, base)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { setIsDirty, setGuardMessage, setSaveHandler } = useNavGuard()

  // When the saved profile (re)loads, e.g. after a save, it becomes the new baseline. A render-time
  // reset keyed on the baseline, so it never clobbers typing.
  const baseKey = `${base.firstName} ${base.lastName} ${base.avatar ?? ''}`
  const [syncedKey, setSyncedKey] = useState(baseKey)
  if (baseKey !== syncedKey) {
    setSyncedKey(baseKey)
    form.reset(base)
  }

  const changes = profileChanges(base, form.values)

  // Resolves to whether the save went through: the navigation guard waits on it before leaving.
  const save = async (): Promise<boolean> => {
    if (!changes.isDirty || isSaving) return false
    const parsed = profileSchema.safeParse(form.values)
    if (!parsed.success) return false
    const data = parsed.data
    setIsSaving(true)
    try {
      const payload: Parameters<typeof saveUser>[0] = {}
      if (changes.nameChanged) {
        payload.first_name = data.firstName || null
        payload.last_name = data.lastName || null
      }
      if (changes.avatarChanged) payload.profile_picture = data.avatar
      // The PATCH returns the saved profile: seed ["me"] with it (AuthProvider follows that query)
      // instead of a second GET /users/me.
      currentUser.set(await saveUser(payload))
      trackBrowserEvent('profile_updated', { name_changed: changes.nameChanged, avatar_changed: changes.avatarChanged })
      toast.success('Account details updated')
      setIsEditing(false)
      return true
    } catch {
      toast.error('Failed to save — please try again')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Navigation guard: the message, the dirty flag, and a stable save handler that reads the latest
  // `save` through a ref (registering the closure itself would re-register every render).
  const isDirtyRef = useRef(false)
  const saveRef = useRef(save)
  useEffect(() => {
    isDirtyRef.current = changes.isDirty
    saveRef.current = save
  })
  useEffect(() => { setIsDirty(changes.isDirty) }, [changes.isDirty, setIsDirty])
  useEffect(() => {
    setGuardMessage({ title: 'Unsaved profile changes', description: 'Your profile changes will be lost if you leave now.' })
    setSaveHandler(() => saveRef.current())
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      setGuardMessage(null)
      setSaveHandler(null)
      setIsDirty(false)
    }
  }, [setGuardMessage, setSaveHandler, setIsDirty])

  // The picture is staged locally until Save; reading and resizing it is async, so it gets a toast.
  const pickAvatar = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    if (file.size > MAX_UPLOAD_BYTES) { toast.error('That image is too large (max 8 MB)'); return }
    const toastId = toast.loading('Updating profile picture…')
    try {
      form.setField('avatar', await fileToAvatarDataUrl(file))
      toast.success('Profile picture updated', { id: toastId })
    } catch {
      toast.error('Could not read that image', { id: toastId })
    }
  }

  return {
    values: form.values,
    errors: form.errors,
    setField: form.setField,
    isDirty: changes.isDirty,
    isValid: form.isValid,
    isEditing,
    isSaving,
    save,
    startEditing: () => { setIsEditing(true); toast.info('Editing profile') },
    cancel: () => { form.reset(base); setIsEditing(false); toast.info('Changes discarded') },
    pickAvatar,
    removeAvatar: () => { form.setField('avatar', null); toast.success('Profile picture removed') },
  }
}

export type ProfileForm = ReturnType<typeof useProfileForm>
