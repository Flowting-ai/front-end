'use client'

import React, { useState } from 'react'
import { SearchOneIcon, CancelOneIcon, FilterMailIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { EMPTY_FILTERS, type AgentFilters, type SortKey } from '../_hooks/use-agent-filters'

const sortLabels: Record<SortKey, string> = {
  activity: 'Activity',
  az:       'A to Z',
  za:       'Z to A',
}

export interface AgentsToolbarProps {
  search: string
  setSearch: (value: string) => void
  sort: SortKey
  setSort: (value: SortKey) => void
  filters: AgentFilters
  setFilters: React.Dispatch<React.SetStateAction<AgentFilters>>
  activeFilterCount: number
  toggleFilter: <K extends keyof AgentFilters>(key: K, value: string) => void
  uniqueModelNames: string[]
}

export function AgentsToolbar({
  search, setSearch, sort, setSort, filters, setFilters,
  activeFilterCount, toggleFilter, uniqueModelNames,
}: AgentsToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '7px 10px',
          borderRadius: 10,
          background: 'var(--text-field-bg)',
          boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--text-field-ring)',
          width: 450,
        }}>
          <SearchOneIcon size={16} style={{ color: 'var(--neutral-500)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agent"
            aria-label="Search agents"
            style={{
              flex: '1 0 0',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--neutral-600)',
              padding: '0 2px',
            }}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: 'var(--neutral-400)',
                flexShrink: 0,
                borderRadius: 4,
              }}
            >
              <CancelOneIcon size={12} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Sort dropdown */}
        <Dropdown.Float
          open={sortOpen}
          onOpenChange={setSortOpen}
          placement="bottom-end"
          trigger={
            <Button variant="secondary">
              Sort by : {sortLabels[sort]}
            </Button>
          }
        >
          <Dropdown maxHeight={false}>
            <Dropdown.Section>
              {(['activity', 'az', 'za'] as SortKey[]).map(k => (
                <Dropdown.Item
                  key={k}
                  label={sortLabels[k]}
                  selected={sort === k}
                  onClick={() => { setSort(k); setSortOpen(false) }}
                  fluid
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>

        {/* Filter dropdown */}
        <Dropdown.Float
          open={filterOpen}
          onOpenChange={setFilterOpen}
          placement="bottom-end"
          trigger={
            <Button
              variant={activeFilterCount > 0 ? 'default' : 'secondary'}
              leftIcon={<FilterMailIcon animated />}
            >
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
            </Button>
          }
        >
          <Dropdown style={{ minWidth: 240 }}>
            {/* Clear all — only shown when filters are active */}
            {activeFilterCount > 0 && (
              <Dropdown.Item
                label="Clear all filters"
                fluid
                onClick={() => setFilters(EMPTY_FILTERS)}
              />
            )}

            {/* Status */}
            <Dropdown.Section label="Status">
              {([
                { id: 'live',   label: 'Live'   },
                { id: 'draft',  label: 'Draft'  },
                { id: 'paused', label: 'Paused' },
              ] as const).map(({ id, label }) => (
                <Dropdown.Item
                  key={id}
                  label={label}
                  fluid
                  showCheckbox
                  checkboxChecked={filters.status.has(id)}
                  onCheckboxChange={() => toggleFilter('status', id)}
                />
              ))}
            </Dropdown.Section>

            {/* Visibility filter UI hidden along with the rest of the
                shared-agent UI — `filters.visibility`/`AgentFilters`
                and its application in filterPanelFiltered below stay
                intact (always empty now, harmlessly a no-op) so this
                section can be re-added without rebuilding it. */}

            {/* Super Link */}
            <Dropdown.Section label="Super Link">
              {([
                { id: 'has-link', label: 'Has active link' },
                { id: 'no-link',  label: 'No link'         },
              ] as const).map(({ id, label }) => (
                <Dropdown.Item
                  key={id}
                  label={label}
                  fluid
                  showCheckbox
                  checkboxChecked={filters.superLink.has(id)}
                  onCheckboxChange={() => toggleFilter('superLink', id)}
                />
              ))}
            </Dropdown.Section>

            {/* Model — only shown when at least one persona has a model */}
            {uniqueModelNames.length > 0 && (
              <Dropdown.Section label="Model">
                {uniqueModelNames.map(name => (
                  <Dropdown.Item
                    key={name}
                    label={name}
                    fluid
                    showCheckbox
                    checkboxChecked={filters.models.has(name)}
                    onCheckboxChange={() => toggleFilter('models', name)}
                  />
                ))}
              </Dropdown.Section>
            )}
          </Dropdown>
        </Dropdown.Float>
      </div>
    </div>
  )
}
