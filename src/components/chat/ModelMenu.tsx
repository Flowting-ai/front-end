'use client'

import React from 'react'
import { TickTwoIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { trackFeature } from '@/lib/analytics/events'
import { sortModels, isSouvenirMuseModel } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai-model'

function isSameModel(a: AIModel | null, b: AIModel): boolean {
  return a?.id === b.id && a?.modelId === b.modelId
}

// Caps the "Select model" section at 5 visible rows, scrolling for the rest.
// This lives on a div nested INSIDE that section rather than on the outer
// `<Dropdown maxHeight>` (which is still `false`, see below) so the Souvenir
// Muse and Thinking sections stay fully visible below it instead of being
// pulled into the same scroll area. Row math matches Popover's own "plain
// row" formula (POPOVER_DEFAULT_MAX_HEIGHT's comment): 5px pad + 22px
// line-height + 5px pad = 32px/row, +4px gap between rows (DropdownSection's
// item-stack gap).
const VISIBLE_MODEL_ROWS = 5
const MODEL_ROW_HEIGHT = 32
const MODEL_ROW_GAP = 4
const MODEL_LIST_MAX_HEIGHT =
  VISIBLE_MODEL_ROWS * MODEL_ROW_HEIGHT + (VISIBLE_MODEL_ROWS - 1) * MODEL_ROW_GAP

export interface ModelMenuProps {
  /** Called right after a model is picked or the adaptive-thinking switch is
   *  toggled — lets the caller (ChatInput, via a cloned prop) close the
   *  dropdown hosting this menu. Neither action is a reason to keep it open. */
  onClose?: () => void
}

export function ModelMenu({ onClose }: ModelMenuProps = {}) {
  const { models, selectedModel, selectModel, enableReasoning, setEnableReasoning } = useModelSelectorContext()
  const sortedModels = sortModels(models)
  // Souvenir's own tiers (Advanced/Standard/Basic today) get their own
  // labelled section below the general model list — see isSouvenirMuseModel.
  const museModels = sortedModels.filter(isSouvenirMuseModel)
  const regularModels = sortedModels.filter((model) => !isSouvenirMuseModel(model))

  const renderModelItem = (model: AIModel) => {
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
  }

  return (
    // maxHeight={false} opts out of Popover's own ScrollArea — same pattern
    // AccountMenu uses (src/components/AccountMenu/index.tsx). ScrollArea's
    // `.kaya-scrollbar` sets `scrollbar-gutter: stable`, which reserves a
    // right-side gutter unconditionally (so rows don't shift width when a
    // scrollbar appears/disappears) — the real source of the extra right-side
    // gap, not the panel width. The Souvenir Muse and Thinking sections below
    // are short and fixed, so there's no gutter to reserve for them; the
    // "Select model" section manages its own scroll/gutter independently
    // (see MODEL_LIST_MAX_HEIGHT above) so it can grow past 5 rows without
    // capping the whole menu's height.
    <Dropdown size="md" maxHeight={false}>
      {regularModels.length > 0 && (
        <Dropdown.Section label="Select model" fluid>
          <div
            className="kaya-scrollbar"
            style={{
              display:              'flex',
              flexDirection:        'column',
              gap:                  `${MODEL_ROW_GAP}px`,
              maxHeight:            MODEL_LIST_MAX_HEIGHT,
              overflowY:            'auto',
              overscrollBehaviorY:  'contain',
            }}
          >
            {regularModels.map(renderModelItem)}
          </div>
        </Dropdown.Section>
      )}
      {museModels.length > 0 && (
        <Dropdown.Section label="Souvenir Muse" fluid divider={regularModels.length > 0}>
          {museModels.map(renderModelItem)}
        </Dropdown.Section>
      )}
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
