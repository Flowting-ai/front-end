import { describe, expect, it } from 'vitest'
import { rollupContext, toActivityPlan, toPlan } from './run-view'

const nodes = [
  {
    id: 'a',
    task: 'Pull Shopify orders\nlast 90 days',
    context: { connectors: ['shopify'], pins: ['pin-1'], files: ['orders.csv'] },
    is_critical: true,
    status: 'completed',
    started_at: '2026-07-18T10:00:00Z',
    completed_at: '2026-07-18T10:00:02Z',
    result_preview: '342 orders',
  },
  {
    id: 'b',
    task: 'Post summary to Slack',
    model_id: '55555555-5555-5555-5555-555555555555',
    context: { connectors: ['slack', 'shopify'], pins: ['pin-1', 'pin-2'] },
    status: 'failed',
    error: 'channel_not_found',
  },
]

describe('toPlan', () => {
  it('reads either steps or nodes and derives the label from the task', () => {
    const fromSteps = toPlan({ summary: 's', steps: nodes, edges: [{ from: 'a', to: 'b' }] })
    const fromNodes = toPlan({ summary: 's', nodes, edges: [{ from: 'a', to: 'b' }] })
    expect(fromSteps.nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(fromNodes.nodes[0].label).toBe('Pull Shopify orders')
    expect(fromNodes.edges).toEqual([{ from: 'a', to: 'b' }])
  })

  it('resolves connectors to the shared Connector object', () => {
    const plan = toPlan({ nodes })
    const [shopify] = plan.nodes[0].context.connectors
    expect(shopify.slug).toBe('shopify')
    expect(shopify.name).toBeTruthy()
  })

  it('resolves pins and models through resolvers when supplied', () => {
    const plan = toPlan({ nodes }, {
      pin:   (id) => ({ id, title: `Pin ${id}` }),
      model: (id) => ({ id, name: 'Opus', company: 'Anthropic' }),
    })
    expect(plan.nodes[0].context.pins[0].title).toBe('Pin pin-1')
    expect(plan.nodes[1].model?.name).toBe('Opus')
  })
})

describe('toActivityPlan', () => {
  it('inherits the plan node fields and adds runtime state', () => {
    const plan = toActivityPlan({ nodes })
    const [first, second] = plan.nodes
    expect(first.label).toBe('Pull Shopify orders')
    expect(first.isCritical).toBe(true)
    expect(first.status).toBe('complete')
    expect(first.resultPreview).toBe('342 orders')
    expect(first.completedAt).toBe('2026-07-18T10:00:02Z')
    expect(second.status).toBe('failed')
    expect(second.error).toBe('channel_not_found')
  })

  it('lets the live overlay win over persisted runtime', () => {
    const plan = toActivityPlan({ nodes }, {}, {
      statusById: { a: 'executing' },
      outputById: { a: 'streaming so far' },
    })
    expect(plan.nodes[0].status).toBe('executing')
    expect(plan.nodes[0].resultPreview).toBe('streaming so far')
  })

  it('carries live stream detail and used connectors through the overlay', () => {
    const plan = toActivityPlan({ nodes }, {}, {
      detailById: { a: 'Searching Shopify orders' },
      usedById:   { a: ['shopify'] },
    })
    expect(plan.nodes[0].streamDetail).toBe('Searching Shopify orders')
    expect(plan.nodes[0].usedConnectors).toEqual(['shopify'])
    expect(plan.nodes[1].streamDetail).toBeNull()
    expect(plan.nodes[1].usedConnectors).toEqual([])
  })
})

describe('rollupContext', () => {
  it('unions and dedupes context across nodes', () => {
    const panel = rollupContext(toActivityPlan({ nodes }))
    expect(panel.connectors.map((c) => c.slug).sort()).toEqual(['shopify', 'slack'])
    expect(panel.pins.map((p) => p.id).sort()).toEqual(['pin-1', 'pin-2'])
    expect(panel.files.map((f) => f.name)).toEqual(['orders.csv'])
  })

  it('only ever contains what the plan declares', () => {
    const panel = rollupContext(toPlan({ nodes: [nodes[1]] }))
    expect(panel.connectors.map((c) => c.slug).sort()).toEqual(['shopify', 'slack'])
    expect(panel.files).toEqual([])
  })

  it('is empty for a plan that declares no context', () => {
    const panel = rollupContext(toPlan({ nodes: [{ id: 'x', task: 'Think' }] }))
    expect(panel.connectors).toEqual([])
    expect(panel.pins).toEqual([])
    expect(panel.persona).toBeNull()
  })
})
