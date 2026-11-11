'use client'

import React from 'react'
import { TickTwoIcon, ArrowRightOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { POPOVER_WIDTHS } from '@/components/Popover'
import * as SliderPrimitive from '@radix-ui/react-slider'
import styles from './EffortSlider.module.css'
import { useModelSelectorContext, type ModelAlgorithm } from '@/context/model-selector-context'
import { trackFeature } from '@/lib/analytics/events'
import { sortModels, modelIconSource, AUTO_ROUTING_LABELS, isAutoRoutingModelName } from '@/lib/ai-models'
import { ModelIcon } from '@/components/ModelIcon'
import type { AIModel } from '@/types/ai-model'

// The panel this tooltip hangs off is a size="md" Popover (POPOVER_WIDTHS.md),
// so the tooltip is capped to that width and stays within the menu's own edges.
const TOOLTIP_WIDTH = POPOVER_WIDTHS.md

/**
 * What auto selection actually does, next to the section header that offers it.
 * A section header can't carry a sublabel, and the two tier rows under it are
 * just names — without this, "Auto selects for you" is the whole explanation.
 */
function AutoSelectInfo() {
  return (
    <Tooltip
      side="bottom"
      align="start"
      sideOffset={6}
      // Narrower than the panel it hangs from, so it stays inside the menu's own
      // footprint instead of spilling past its edges.
      maxWidth={TOOLTIP_WIDTH}
      content={
        // The tooltip's own wrapper is a <span>, so these are display:block
        // spans, not divs. A lead paragraph, the two tiers as a list, then the
        // two things worth knowing — rather than one unbroken block of text.
        <span style={{ display: 'block' }}>
          <span style={{ display: 'block' }}>
            Souvenir reads each message and sends it to the model that fits it: a quick
            question to a fast model, a long or difficult one to a stronger model.
          </span>
          <span style={{ display: 'block', marginTop: 8 }}>
            {[
              ['Souvenir Standard', 'the quicker, cheaper models'],
              ['Souvenir Pro', 'the strongest models when the work calls for it'],
            ].map(([tier, detail]) => (
              <span key={tier} style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <span aria-hidden style={{ opacity: 0.5 }}>•</span>
                <span>
                  <strong style={{ fontWeight: 'var(--font-weight-semibold)' }}>{tier}</strong>
                  {' — '}
                  {detail}
                </span>
              </span>
            ))}
          </span>
          <span style={{ display: 'block', marginTop: 8, opacity: 0.75 }}>
            Picking a model yourself turns auto selection off until you choose a tier again.
          </span>
        </span>
      }
    >
      <button
        type="button"
        aria-label="How auto selection works"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'var(--dropdown-menu-item-muted)',
          cursor: 'help',
          lineHeight: 0,
        }}
        // The header row is inert; this button is the one thing in it that
        // responds, so its own click must not read as picking anything.
        onClick={(e) => e.preventDefault()}
      >
        <InformationCircleIcon size={14} color="currentColor" />
      </button>
    </Tooltip>
  )
}

function isSameModel(a: AIModel | null, b: AIModel): boolean {
  return a?.id === b.id && a?.modelId === b.modelId
}

// Display copy for each auto-routing tier — sourced from lib/ai-models.ts so
// the trigger button label (useModelButtonLabel), the menu rows below, and
// the settings account page's Default Model picker (which groups these
// under their own "Auto Routing" section) all agree on the same strings.
const ALGORITHM_LABELS: Record<ModelAlgorithm, string> = AUTO_ROUTING_LABELS

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

function effortLabel(effort: string | null): string {
  if (!effort) return 'Off'
  return effort.charAt(0).toUpperCase() + effort.slice(1)
}

// Off is neutral; the supported efforts warm from calm blue through violet
// and amber to a hot red, spread evenly over however many the model has.
const EFFORT_RAMP = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']

function effortColor(index: number, count: number): string {
  if (index === 0) return 'var(--neutral-500)'
  const levels = count - 1
  const t = levels <= 1 ? 1 : (index - 1) / (levels - 1)
  return EFFORT_RAMP[Math.round(t * (EFFORT_RAMP.length - 1))]
}

/** Thinking effort as a stepped slider: Off, then each effort the model
 *  supports, low → high. The menu stays open while dragging — the change
 *  applies live and only analytics waits for the commit. */
function EffortSlider({ options, value, onChange }: {
  options: string[]
  value: string | null
  onChange: (effort: string | null) => void
}) {
  const steps = [null, ...options]
  const index = Math.max(0, steps.indexOf(value))
  const color = effortColor(index, steps.length)
  return (
    <div
      // Dropdown's roving focus would otherwise steal the arrow keys the
      // slider thumb uses to step.
      onKeyDown={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.stopPropagation() }}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 10px 8px', '--effort-color': color } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, lineHeight: '18px' }}>
        <span style={{ color: 'var(--neutral-700)' }}>Effort</span>
        <span key={index} className={styles.value}>{effortLabel(steps[index])}</span>
      </div>
      <SliderPrimitive.Root
        className={styles.root}
        min={0}
        max={steps.length - 1}
        step={1}
        value={[index]}
        onValueChange={([next]) => onChange(steps[next] ?? null)}
        onValueCommit={([next]) => trackFeature('effort_level_changed', { effort: steps[next] ?? 'off' })}
      >
        <SliderPrimitive.Track className={styles.track}>
          <SliderPrimitive.Range className={styles.range} />
        </SliderPrimitive.Track>
        <div aria-hidden className={styles.pips}>
          {steps.map((s, i) => (
            <span key={s ?? 'off'} className={styles.pip} data-active={i < index} data-current={i === index} />
          ))}
        </div>
        <SliderPrimitive.Thumb className={styles.thumb} aria-label="Thinking effort" aria-valuetext={effortLabel(steps[index])} />
      </SliderPrimitive.Root>
      <div className={styles.labels}>
        {steps.map((s, i) => (
          // Clickable as a shortcut to that step; the thumb stays the keyboard control, so no tab stop.
          <span
            key={s ?? 'off'}
            className={styles.label}
            data-active={i === index}
            style={{ cursor: 'pointer' }}
            onClick={() => { onChange(s); trackFeature('effort_level_changed', { effort: s ?? 'off' }) }}
          >
            {effortLabel(s)}
          </span>
        ))}
      </div>
    </div>
  )
}

export interface ModelMenuProps {
  /** Called right after a model, tier or effort is picked — lets the caller
   *  (ChatInput, via a cloned prop) close the dropdown hosting this menu.
   *  None of those is a reason to keep it open. */
  onClose?: () => void
}

export function ModelMenu({ onClose }: ModelMenuProps = {}) {
  const {
    models, selectedModel, selectModel,
    algorithm, selectAlgorithm,
    effortOptions, reasoningEffort, setReasoningEffort,
  } = useModelSelectorContext()
  // The catalog can carry entries literally named "Souvenir Pro"/"Souvenir
  // Standard" (aliases for the Auto Routing tiers above) alongside the real
  // provider models — excluded here so a routing alias doesn't show up a
  // second time as if it were its own distinct, directly-selectable model.
  const sortedModels = sortModels(models).filter(
    (model) => !isAutoRoutingModelName(model.modelName),
  )
  // What "Select a Model" shows as chosen: an Auto Routing tier or a model.
  const currentLabel = algorithm ? ALGORITHM_LABELS[algorithm] : selectedModel?.modelName
  // No provider backs an auto-routing tier, so it resolves to the Souvenir mark.
  const currentIconSource = algorithm || !selectedModel ? null : modelIconSource(selectedModel)

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
    // own content (the "Select a Model" row + the thinking slider) never needs
    // to scroll; the Auto Routing tiers and the full catalog live one level down
    // in the "Select a Model" submenu, whose model list keeps its own 5-row cap
    // (see MODEL_LIST_MAX_HEIGHT + the Dropdown.Submenu below).
    <Dropdown size="md" maxHeight={false}>
      <Dropdown.Section label="Model" labelEmphasis="strong" fluid>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              fluid
              // The chosen model leads the row, in Google Sans at body-lg — it is
              // the value this row carries. What the row DOES ("Change model") is
              // the subtext under it. With nothing picked yet there is no value,
              // so the action becomes the label.
              emphasis="strong"
              // The chosen model's own logo — the Souvenir mark for an Auto
              // Routing tier, or when nothing is picked yet. On the free-form
              // avatar slot (not `icon`) so the logo sits on a square tile
              // spanning the row's two lines, at the same 16px as every other
              // logo in this menu.
              avatar={<ModelIcon model={currentIconSource ?? undefined} size={16} />}
              label={currentLabel ?? 'Select a model'}
              subLabel={currentLabel ? 'Change model' : undefined}
              selected={!!currentLabel}
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
            {/* Auto Routing tiers first, Standard before Pro (lighter to stronger). */}
            {/* The headers name who does the choosing, which is the actual
                difference between the two groups — "Automatic" over "Models"
                left the reader to work out that the second list was manual. */}
            <Dropdown.Section label="Auto selects for you" labelEmphasis="strong" labelBadge={<AutoSelectInfo />} fluid>
              {renderAlgorithmItem('base')}
              {renderAlgorithmItem('pro')}
            </Dropdown.Section>
            <Dropdown.Section label="Choose a model yourself" labelEmphasis="strong" fluid divider>
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
                className="kaya-scrollbar kaya-no-gutter"
                style={{
                  maxHeight:            MODEL_LIST_MAX_HEIGHT,
                  overflowY:            'auto',
                  overscrollBehaviorY:  'contain',
                  // Keeps hover/selected row backgrounds and focus rings from
                  // being clipped flush against the scroll container's own
                  // edges — same reason PresetModelSelectorDialog's model
                  // list padds its scroll div.
                  padding:              '3px 2px 3px 3px',
                  // The bar sat ~14px in from the panel's right edge: this div's
                  // own padding, plus the scrollbar, plus the section's 8px.
                  // Pulling the scroll box out into that section padding puts the
                  // bar near the edge where it belongs, and gives the rows back
                  // the width it was taking.
                  marginRight:          '-5px',
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
      {effortOptions.length > 0 && (
        <Dropdown.Section label="Thinking" labelEmphasis="strong" fluid divider>
          <EffortSlider
            options={effortOptions}
            value={reasoningEffort}
            onChange={setReasoningEffort}
          />
        </Dropdown.Section>
      )}
    </Dropdown>
  )
}

/** Derive the model button label from context — call at page level. */
export function useModelButtonLabel(): string | undefined {
  const { selectedModel, algorithm } = useModelSelectorContext()
  if (algorithm) return ALGORITHM_LABELS[algorithm]
  return selectedModel?.modelName
}

/** The provider the model button's logo resolves from — `null` for an
 *  auto-routing tier, which falls back to the Souvenir mark. */
export function useModelButtonIcon(): string | null {
  const { selectedModel, algorithm } = useModelSelectorContext()
  if (algorithm || !selectedModel) return null
  return modelIconSource(selectedModel)
}
