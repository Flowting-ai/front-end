'use client'

import React, { useEffect, useState } from 'react'
import { ModelIcon } from '@/components/ModelIcon'
import { fetchModelsWithCache, isAutoRoutingModelName, modelIconSource, pickDefaultModel, sortModels } from '@/lib/ai-models'
import { SETTINGS_DEFAULT_MODEL_KEY } from '@/lib/storage-keys'
import type { AIModel } from '@/types/ai-model'
import { PillSelect } from './PillSelect'

/**
 * Default model choice (currently hidden on Account). There is no backend field for a per-user
 * default model: new chats use pickDefaultModel(). So this only remembers the choice in this
 * browser and feeds nothing else, flagged here rather than wired to a contract that does not exist.
 * It loads the catalogue only when rendered.
 */
export function DefaultModelPicker() {
  const [models, setModels] = useState<AIModel[]>([])
  const [value, setValue] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetchModelsWithCache().then(fetched => {
      if (cancelled) return
      const ordered = sortModels(fetched.filter(m => !m.blocked))
      setModels(ordered)
      let stored: string | null = null
      try { stored = window.localStorage.getItem(SETTINGS_DEFAULT_MODEL_KEY) } catch { /* unavailable */ }
      const match = stored && ordered.some(m => m.modelName === stored) ? stored : null
      setValue(match ?? pickDefaultModel(ordered)?.modelName ?? '')
    })
    return () => { cancelled = true }
  }, [])

  const names = models.map(m => m.modelName)
  const descriptions = Object.fromEntries(models.map(m => [m.modelName, m.description ?? ''])) as Record<string, string>
  // Auto-routing aliases have no real provider, so they show the Souvenir mark, as in ModelMenu.
  const icons = Object.fromEntries(models.map(m => [
    m.modelName,
    <ModelIcon key={m.modelName} model={isAutoRoutingModelName(m.modelName) ? undefined : modelIconSource(m)} size={16} />,
  ])) as Record<string, React.ReactElement>

  return (
    <PillSelect
      label="Default model"
      value={value}
      options={names}
      onChange={(next) => {
        setValue(next)
        try { window.localStorage.setItem(SETTINGS_DEFAULT_MODEL_KEY, next) } catch { /* best effort */ }
      }}
      descriptions={descriptions}
      icons={icons}
      // The same "Auto Routing" / "Models" groups as the composer's ModelMenu.
      sections={[
        { label: 'Auto Routing', options: names.filter(isAutoRoutingModelName) },
        { label: 'Models', options: names.filter(name => !isAutoRoutingModelName(name)) },
      ]}
    />
  )
}
