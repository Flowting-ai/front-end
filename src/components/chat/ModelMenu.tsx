'use client'

import React from 'react'
import { Dropdown } from '@/components/Dropdown'
import { useModelSelectorContext } from '@/context/model-selector-context'

export function ModelMenu() {
  const {
    museActive,
    museAdvanced,
    activateMuse,
    deactivateMuse,
    setMuseAdvanced,
    enableReasoning,
    setEnableReasoning,
  } = useModelSelectorContext()

  return (
    <Dropdown size="md">
      <Dropdown.Section fluid>
        <Dropdown.Item
          label="Souvenir Muse: Advanced"
          subLabel="Most capable for ambitious work"
          showSwitch
          switchChecked={museActive && museAdvanced}
          onSwitchChange={(checked) => {
            if (checked) {
              setMuseAdvanced(true)
            } else if (museActive) {
              deactivateMuse()
            } else {
              activateMuse()
            }
          }}
          fluid
        />
        <Dropdown.Item
          label="Adaptive thinking"
          subLabel="Enable extended reasoning"
          showSwitch
          switchChecked={enableReasoning}
          onSwitchChange={setEnableReasoning}
          fluid
        />
      </Dropdown.Section>
    </Dropdown>
  )
}

/** Derive the model button label from context — call at page level. */
export function useModelButtonLabel(): string | undefined {
  const { selectedModel, museActive, museAdvanced } = useModelSelectorContext()
  return museActive
    ? museAdvanced ? 'Souvenir AI Muse (Advanced)' : 'Souvenir AI Muse (Basic)'
    : selectedModel?.modelName
}
