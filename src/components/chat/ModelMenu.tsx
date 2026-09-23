'use client'

import React from 'react'
import { TickTwoIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { useModelSelectorContext, type ModelAlgorithm } from '@/context/model-selector-context'
import { trackFeature } from '@/lib/analytics/events'
import { sortModels } from '@/lib/ai-models'
import { ModelIcon } from '@/components/ModelIcon'
import type { AIModel } from '@/types/ai-model'

function isSameModel(a: AIModel | null, b: AIModel): boolean {
  return a?.id === b.id && a?.modelId === b.modelId
}

// Display copy for each auto-routing tier — the only place this mapping
// lives, so the trigger button label (useModelButtonLabel) and the menu
// rows below always agree.
const ALGORITHM_LABELS: Record<ModelAlgorithm, string> = {
  pro:  'Souvenir Pro',
  base: 'Souvenir Standard',
}

// Lowercased for case-insensitive matching against a catalog model's
// `modelName` — see the filter on `sortedModels` below.
const ALGORITHM_MODEL_NAMES = new Set(
  Object.values(ALGORITHM_LABELS).map((label) => label.toLowerCase()),
)

// Legacy Souvenir-tier names ("Advanced"/"Standard"/"Basic") that can still
// appear in the catalog alongside the real provider models — these are
// Claude under the hood, but their own companyName/modelName don't reliably
// resolve to "Claude" via toLlmIconId, so it's forced explicitly here rather
// than showing no logo for them.
const CLAUDE_TIER_NAMES = new Set(['advanced', 'standard', 'basic'])

/** Resolves what to hand ModelIcon's `model` prop for a catalog model row. */
function modelIconSource(model: AIModel): string | null {
  if (CLAUDE_TIER_NAMES.has(model.modelName.trim().toLowerCase())) return 'Claude'
  return model.companyName || model.modelName
}

// Caps the "Select a Model" submenu at 5 visible rows, scrolling (kaya
// scrollbar) for the rest — overrides Popover's own default ~7-row cap so
// this list matches the product's explicit 5-row spec. Row math: 5px pad +
// 22px line-height + 5px pad = 32px/row (Popover's own "plain row" formula),
// +4px gap between rows (DropdownSection's item-stack gap).
const VISIBLE_MODEL_ROWS = 5
const MODEL_ROW_HEIGHT = 32
const MODEL_ROW_GAP = 4
const MODEL_LIST_MAX_HEIGHT =
  VISIBLE_MODEL_ROWS * MODEL_ROW_HEIGHT + (VISIBLE_MODEL_ROWS - 1) * MODEL_ROW_GAP

export interface ModelMenuProps {
  /** Called right after a selection is made or the adaptive-thinking switch
   *  is toggled — lets the caller (ChatInput, via a cloned prop) close the
   *  dropdown hosting this menu. None of those is a reason to keep it open. */
  onClose?: () => void
}

export function ModelMenu({ onClose }: ModelMenuProps = {}) {
  const {
    models, selectedModel, selectModel,
    algorithm, selectAlgorithm,
    enableReasoning, setEnableReasoning,
  } = useModelSelectorContext()
  // The catalog can carry entries literally named "Souvenir Pro"/"Souvenir
  // Standard" (aliases for the Auto Routing tiers above) alongside the real
  // provider models — excluded here so a routing alias doesn't show up a
  // second time as if it were its own distinct, directly-selectable model.
  const sortedModels = sortModels(models).filter(
    (model) => !ALGORITHM_MODEL_NAMES.has(model.modelName.trim().toLowerCase()),
  )
  const hasDirectSelection = !algorithm && !!selectedModel

  const renderModelItem = (model: AIModel) => {
    const selected = isSameModel(selectedModel, model)
    return (
      <Dropdown.Item
        key={`${model.id}-${model.modelId}`}
        fluid
        // ModelIcon (not the `llm` prop) so an unrecognized provider falls
        // back to the Souvenir mark instead of an empty slot, and so the
        // icon slot is `icon` (DropdownMenuItem clones it to a fixed 20px)
        // rather than `llm` (fixed 22px) — a deliberate, slightly smaller size.
        icon={<ModelIcon model={modelIconSource(model)} size={16} />}
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

  const renderAlgorithmItem = (value: ModelAlgorithm) => {
    const selected = algorithm === value
    return (
      <Dropdown.Item
        key={value}
        fluid
        // No specific provider backs an algorithm tier — omitting `model`
        // resolves to nothing in toLlmIconId, so ModelIcon falls back to
        // the actual Souvenir mark, not an empty slot.
        icon={<ModelIcon size={16} />}
        label={ALGORITHM_LABELS[value]}
        selected={selected}
        rightIcon={<TickTwoIcon style={{ opacity: selected ? 1 : 0 }} />}
        onClick={() => {
          trackFeature('model_selector_manual', { model_id: `algorithm:${value}`, model_type: 'algorithm' })
          selectAlgorithm(value)
          onClose?.()
        }}
      />
    )
  }

  return (
    // maxHeight={false} opts out of Popover's own ScrollArea — same pattern
    // AccountMenu uses (src/components/AccountMenu/index.tsx). This menu's
    // own content (2 algorithm rows + 1 submenu trigger + 1 reasoning row)
    // never needs to scroll; the full catalog lives one level down in the
    // "Select a Model" submenu instead, which enforces its own explicit
    // 5-row cap (see MODEL_LIST_MAX_HEIGHT + the Dropdown.Submenu below).
    <Dropdown size="md" maxHeight={false}>
      <Dropdown.Section label="Auto Routing" fluid>
        {renderAlgorithmItem('pro')}
        {renderAlgorithmItem('base')}
      </Dropdown.Section>
      <Dropdown.Section label="Models" fluid divider>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              fluid
              label="Select a Model"
              subLabel={hasDirectSelection ? selectedModel!.modelName : undefined}
              selected={hasDirectSelection}
              rightIcon={<ArrowRightOneIcon />}
            />
          }
        >
          {/* Hover-triggered, auto-flips horizontally (right of the parent
              panel by default, left when the right side would overflow the
              viewport) — Dropdown.Submenu's built-in behaviour, same
              primitive ChatInput/index.tsx's "Use style" submenu uses.
              maxHeight={false} opts out of Popover's own ~7-row default cap;
              the nested scroll div below enforces the 5-row cap instead
              (same pattern chat/ModelMenu.tsx used for its "Select model"
              section before this redesign — see MODEL_LIST_MAX_HEIGHT). */}
          <Dropdown size="md" maxHeight={false}>
            <Dropdown.Section fluid>
              {/* Two nested divs, not one — the OUTER is the plain-block
                  scroll container (maxHeight + overflow, no display:flex of
                  its own); the INNER is the flex column that stacks the
                  rows. Collapsing these into a single flex div that's ALSO
                  the scroll container makes the rows flex-shrink to fit
                  instead of overflowing: DropdownMenuItem sets
                  `overflow: hidden` on each row, which zeroes a flex item's
                  automatic min-height, so a height-capped flex column
                  squeezes its children instead of scrolling past them. Same
                  two-div split PresetModelSelectorDialog.tsx uses for its
                  model list. */}
              <div
                className="kaya-scrollbar"
                style={{
                  maxHeight:            MODEL_LIST_MAX_HEIGHT,
                  overflowY:            'auto',
                  overscrollBehaviorY:  'contain',
                  // Keeps hover/selected row backgrounds and focus rings from
                  // being clipped flush against the scroll container's own
                  // edges — same reason PresetModelSelectorDialog's model
                  // list padds its scroll div.
                  padding:              '3px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${MODEL_ROW_GAP}px` }}>
                  {sortedModels.map(renderModelItem)}
                </div>
              </div>
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Submenu>
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
  const { selectedModel, algorithm } = useModelSelectorContext()
  if (algorithm) return ALGORITHM_LABELS[algorithm]
  return selectedModel?.modelName
}
