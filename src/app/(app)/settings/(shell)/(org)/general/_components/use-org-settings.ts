'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getOrgSettings, updateOrgSettings } from '@/lib/api/organization'

/** Org settings: the AI instructions (live) and the allowed domains and workspace defaults (cards hidden for now). */
export function useOrgSettings(orgId: string | null) {
  // Settings fields
  const [aiInstructions,           setAiInstructions]           = useState('')
  const [allowedDomains,           setAllowedDomains]           = useState<string[]>([])
  const [defaultChatVisibility,    setDefaultChatVisibility]    = useState('private')
  const [defaultPersonaVisibility, setDefaultPersonaVisibility] = useState('private')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving,  setSettingsSaving]  = useState(false)
  // Separate from settingsSaving (shared by Save instructions/domains/defaults)
  // so clicking Clear doesn't flip "Save instructions"' own label/spinner too.
  const [clearingInstructions, setClearingInstructions] = useState(false)
  const [showAddDomain,   setShowAddDomain]   = useState(false)
  const [addDomainInput,  setAddDomainInput]  = useState('')

  // Load org settings
  useEffect(() => {
    if (!orgId) { setSettingsLoading(false); return }
    setSettingsLoading(true)
    getOrgSettings(orgId)
      .then(s => {
        setAiInstructions(s.orgInstructions ?? '')
        setAllowedDomains(s.allowedEmailDomains ?? [])
        setDefaultChatVisibility(s.defaultChatVisibility ?? 'private')
        setDefaultPersonaVisibility(s.defaultPersonaVisibility ?? 'private')
      })
      .catch(console.error)
      .finally(() => setSettingsLoading(false))
  }, [orgId])

  const handleClearInstructions = async () => {
    if (!orgId) return
    setClearingInstructions(true)
    try {
      const updated = await updateOrgSettings(orgId, { orgInstructions: '' })
      setAiInstructions(updated.orgInstructions ?? '')
      toast.success('Instructions cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear instructions')
    } finally {
      setClearingInstructions(false)
    }
  }

  const handleSaveInstructions = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    const intended = aiInstructions || ''
    try {
      // The PATCH echoes back the persisted settings. Trust that — not the request —
      // so we never show "saved" for a write the server silently dropped.
      // Send "" (not null) to clear: the backend strips null fields from partial
      // updates, so null never clears the column — an empty string does.
      const updated = await updateOrgSettings(orgId, { orgInstructions: aiInstructions })
      const persisted = updated.orgInstructions ?? ''
      setAiInstructions(persisted)
      if (persisted === intended) {
        toast.success('Instructions saved')
      } else {
        toast.error('The server did not save your instructions. Please try again or report this.')
        console.error('[org/general] instructions not persisted', { sent: intended, returned: persisted })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save instructions')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveDefaults = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    try {
      await updateOrgSettings(orgId, {
        defaultChatVisibility,
        defaultPersonaVisibility,
      })
      toast.success('Workspace defaults saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save defaults')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveDomains = async () => {
    if (!orgId) return
    setSettingsSaving(true)
    try {
      await updateOrgSettings(orgId, { allowedEmailDomains: allowedDomains.filter(Boolean) })
      toast.success('Allowed domains saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save domains')
    } finally {
      setSettingsSaving(false)
    }
  }

  return {
    aiInstructions, setAiInstructions, allowedDomains, setAllowedDomains,
    defaultChatVisibility, setDefaultChatVisibility, defaultPersonaVisibility, setDefaultPersonaVisibility,
    settingsLoading, settingsSaving, clearingInstructions, showAddDomain, setShowAddDomain, addDomainInput, setAddDomainInput,
    handleClearInstructions, handleSaveInstructions, handleSaveDefaults, handleSaveDomains,
  }
}

export type OrgSettings = ReturnType<typeof useOrgSettings>
