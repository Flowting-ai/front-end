'use client'

import React from 'react'
import { Dropdown } from '@/components/Dropdown'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { trackFeature } from '@/lib/analytics/events'

export function ModelMenu() {
  const { enableReasoning, setEnableReasoning } = useModelSelectorContext()

  return (
    <Dropdown size="md">
      <Dropdown.Section fluid>
        <Dropdown.Item
          label="Adaptive thinking"
          subLabel="Enable extended reasoning"
          showSwitch
          switchChecked={enableReasoning}
          onSwitchChange={(checked) => { trackFeature('effort_level_changed', { enabled: checked }); setEnableReasoning(checked) }}
          fluid
        />
      </Dropdown.Section>
    </Dropdown>
  )
}

/** Derive the model button label from context — call at page level. */
export function useModelButtonLabel(): string | undefined {
  const { selectedModel } = useModelSelectorContext()
  return selectedModel?.modelName
}
