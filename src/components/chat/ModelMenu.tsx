'use client'

import React from 'react'
import { TickTwoIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { trackFeature } from '@/lib/analytics/events'
import { sortModelsByTier } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai-model'

function isSameModel(a: AIModel | null, b: AIModel): boolean {
  return a?.id === b.id && a?.modelId === b.modelId
}

export interface ModelMenuProps {
  /** Called right after a model is picked or the adaptive-thinking switch is
   *  toggled — lets the caller (ChatInput, via a cloned prop) close the
   *  dropdown hosting this menu. Neither action is a reason to keep it open. */
  onClose?: () => void
}

export function ModelMenu({ onClose }: ModelMenuProps = {}) {
  const { models, selectedModel, selectModel, enableReasoning, setEnableReasoning } = useModelSelectorContext()
  const sortedModels = sortModelsByTier(models)

  return (
    // maxHeight={false} opts out of Popover's ScrollArea — same pattern
    // AccountMenu uses (src/components/AccountMenu/index.tsx). ScrollArea's
    // `.kaya-scrollbar` sets `scrollbar-gutter: stable`, which reserves a
    // right-side gutter unconditionally (so rows don't shift width when a
    // scrollbar appears/disappears) — the real source of the extra right-side
    // gap, not the panel width. This menu's content (3 model rows + one
    // reasoning row) never needs to scroll, so there's no gutter to reserve.
    <Dropdown size="md" maxHeight={false}>
      <Dropdown.Section label="Select model" fluid>
        {sortedModels.map((model) => {
          const selected = isSameModel(selectedModel, model)
          return (
            <Dropdown.Item
              key={`${model.id}-${model.modelId}`}
              fluid
              label={model.modelName}
              selected={selected}
              // Rendered on every row, not just the selected one — keeps the
              // row's right edge consistent whether or not it's the current
              // selection, instead of only gaining content once selected.
              rightIcon={<TickTwoIcon style={{ opacity: selected ? 1 : 0 }} />}
              onClick={() => {
                trackFeature('model_selector_manual', { model_id: String(model.modelId), model_type: model.modelType })
                selectModel(model)
                onClose?.()
              }}
            />
          )
        })}
      </Dropdown.Section>
      <Dropdown.Section label="Thinking" fluid divider>
        <Dropdown.Item
          label="Adaptive thinking"
          subLabel="Enable extended reasoning"
          showSwitch
          switchChecked={enableReasoning}
          onSwitchChange={(checked) => {
            trackFeature('effort_level_changed', { enabled: checked })
            setEnableReasoning(checked)
            // Unlike picking a model, give the switch's own toggle animation
            // time to finish before the menu closes out from under it.
            setTimeout(() => onClose?.(), 400)
          }}
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
