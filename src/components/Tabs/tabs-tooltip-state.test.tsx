import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'

describe('TabsTrigger inside a Tooltip', () => {
  it('keeps its own data-state', () => {
    const html = renderToStaticMarkup(
      <Tabs value="ask">
        <TabsList size="small" aria-label="p">
          {['always', 'ask', 'blocked'].map(m => (
            <Tooltip key={m} content={m} side="top">
              <TabsTrigger value={m} aria-label={m} />
            </Tooltip>
          ))}
        </TabsList>
      </Tabs>,
    )
    expect(html).toContain('data-state="active"')
  })
})
