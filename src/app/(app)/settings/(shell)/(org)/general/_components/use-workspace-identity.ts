'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useNavGuard } from '@/context/nav-guard-context'
import { getOrg, updateOrg } from '@/lib/api/organization'
import { compressImage } from './GeneralParts'

/**
 * The workspace identity card: name, URL slug and logo, staged locally until Save. Unsaved changes
 * feed the app-wide navigation guard and the browser's close/refresh prompt.
 */
export function useWorkspaceIdentity(orgId: string | null) {
  // Identity fields
  const [workspaceName,  setWorkspaceName]  = useState('')
  const [slugValue,      setSlugValue]      = useState('')
  const [orgIdValue,     setOrgIdValue]     = useState('')
  const [logoUrl,        setLogoUrl]        = useState<string | null>(null)
  // Staged logo — not uploaded until Save changes; `logoFile` is what
  // actually gets sent, `logoPreview` is its local data/object URL shown in
  // place of `logoUrl` while staged.
  const [logoFile,       setLogoFile]       = useState<File | null>(null)
  const [logoPreview,    setLogoPreview]    = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [identityLoading, setIdentityLoading] = useState(true)
  const [identitySaving,  setIdentitySaving]  = useState(false)
  const [isEditingIdentity, setIsEditingIdentity] = useState(false)
  // Baselines from the loaded org — the source of truth for the dirty check,
  // separate from the live draft state above (which the inputs write to
  // directly). Updated on load and after a successful save; restored on Cancel.
  const [baseWorkspaceName, setBaseWorkspaceName] = useState('')
  const [baseSlugValue,     setBaseSlugValue]     = useState('')

  // Load org identity
  useEffect(() => {
    if (!orgId) { setIdentityLoading(false); return }
    setIdentityLoading(true)
    // Defensive reset: a staged-but-unsaved logo change (and the "editing"
    // toggle) is scoped to whichever org this component was showing before —
    // if `orgId` ever changes while this page stays mounted, these must clear
    // alongside the name/slug fields below, or `isIdentityDirty` (which
    // includes `logoFile !== null`) can get stuck permanently true, wedging
    // the app-wide nav-guard for every subsequent sidebar click.
    setLogoFile(null)
    setLogoPreview(null)
    setIsEditingIdentity(false)
    getOrg(orgId)
      .then(data => {
        setWorkspaceName(data.name)
        setBaseWorkspaceName(data.name)
        setSlugValue(data.slug)
        setBaseSlugValue(data.slug)
        setOrgIdValue(data.id)
        setLogoUrl(data.logoUrl)
      })
      .catch(console.error)
      .finally(() => setIdentityLoading(false))
  }, [orgId])

  // ── Workspace Identity — dirty tracking + unsaved-changes guard ─────────
  // Same app-wide guard /settings/account uses (nav-guard-context) — leaving
  // this page with unsaved identity edits is caught no matter which sidebar
  // (Settings' own or the main app one) the user clicks, plus a native
  // browser prompt on tab close/refresh.
  const { setIsDirty: setNavDirty, setGuardMessage, setSaveHandler } = useNavGuard()
  const isIdentityDirtyRef = useRef(false)
  const isIdentityDirty = workspaceName.trim() !== baseWorkspaceName.trim() || slugValue.trim() !== baseSlugValue.trim() || logoFile !== null
  // Was written directly during render — moved into a deps-less effect
  // (same fix shape as /settings/account's own isDirtyRef): only ever read
  // later, from inside the beforeunload handler below, so the one-commit
  // delay an effect introduces is safe.
  useEffect(() => {
    isIdentityDirtyRef.current = isIdentityDirty
  })

  useEffect(() => {
    setGuardMessage({
      title:       'Unsaved workspace identity changes',
      description: 'Your workspace name/URL changes will be lost if you leave now.',
    })
    return () => setGuardMessage(null)
  }, [setGuardMessage])

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!isIdentityDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBefore)
    return () => {
      window.removeEventListener('beforeunload', onBefore)
      setNavDirty(false)
      setSaveHandler(null)
    }
  }, [setNavDirty, setSaveHandler])

  useEffect(() => {
    setNavDirty(isIdentityDirty)
  }, [isIdentityDirty, setNavDirty])

  // Stages the logo locally (like the name/slug fields) instead of uploading
  // immediately — it's only actually sent to the backend when Save changes
  // is clicked, alongside whatever else changed (see handleSaveIdentity).
  const handlePickLogo = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setAvatarUploading(true)
    try {
      // Downscale to 512x512 client-side; the data URL doubles as the local
      // preview, and the File built from it is what actually gets uploaded.
      let staged: File = file
      let preview = ''
      try {
        preview = await compressImage(file, 512, 512, 0.85)
        // Same pattern established in the Agents engagement's
        // knowledge/page.tsx fix — consume the response only after
        // confirming it actually succeeded, rather than assuming any
        // resolved fetch means a usable body.
        const previewRes = await fetch(preview)
        if (!previewRes.ok) throw new Error('Failed to read compressed image')
        const blob = await previewRes.blob()
        staged = new File([blob], 'logo.jpg', { type: blob.type || 'image/jpeg' })
      } catch {
        // compression unsupported in this browser (or the status check above
        // rejected it) — fall back to the
        // original file for upload, and an object URL for the preview.
        preview = URL.createObjectURL(file)
      }
      setLogoFile(staged)
      setLogoPreview(preview)
    } catch {
      toast.error('Could not read that image')
    } finally {
      setAvatarUploading(false)
    }
  }, [])

  const handleSaveIdentity = async (): Promise<boolean> => {
    if (!orgId || !isIdentityDirty) return false
    setIdentitySaving(true)
    try {
      const updated = await updateOrg(orgId, { name: workspaceName, slug: slugValue, logoFile })
      setWorkspaceName(updated.name)
      setBaseWorkspaceName(updated.name)
      setSlugValue(updated.slug)
      setBaseSlugValue(updated.slug)
      setLogoUrl(updated.logoUrl)
      setLogoFile(null)
      setLogoPreview(null)
      toast.success('Workspace identity saved')
      setIsEditingIdentity(false)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save identity')
      return false
    } finally {
      setIdentitySaving(false)
    }
  }

  const handleEditIdentity = () => {
    setIsEditingIdentity(true)
    toast.info('Editing workspace identity')
  }

  const handleCancelIdentityEdit = () => {
    setWorkspaceName(baseWorkspaceName)
    setSlugValue(baseSlugValue)
    setLogoFile(null)
    setLogoPreview(null)
    setIsEditingIdentity(false)
    toast.info('Changes discarded')
  }

  // Keep the guard's registered save handler pointed at the latest
  // `handleSaveIdentity` closure — same stable-ref-wrapper pattern
  // /settings/account uses, since the closure is recreated every render.
  const handleSaveIdentityRef = useRef(handleSaveIdentity)
  // Was written directly during render — moved into a deps-less effect, same
  // fix shape as isIdentityDirtyRef above and /settings/account's handleSaveRef.
  useEffect(() => {
    handleSaveIdentityRef.current = handleSaveIdentity
  })
  useEffect(() => {
    setSaveHandler(() => handleSaveIdentityRef.current())
    return () => setSaveHandler(null)
  }, [setSaveHandler])

  const copyOrgId = () => {
    void navigator.clipboard.writeText(orgIdValue)
    toast.success('Copied to clipboard')
  }

  return {
    workspaceName, setWorkspaceName, slugValue, setSlugValue, orgIdValue, logoUrl, logoPreview,
    avatarUploading, logoInputRef, identityLoading, identitySaving, isEditingIdentity, isIdentityDirty,
    handlePickLogo, handleSaveIdentity, handleEditIdentity, handleCancelIdentityEdit, copyOrgId,
  }
}

export type WorkspaceIdentity = ReturnType<typeof useWorkspaceIdentity>
