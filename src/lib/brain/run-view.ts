import { z } from 'zod'
import { connectorSchema, toConnector, type Connector } from '@/lib/connector'
import { parsePlanNodes, type BackendPlanNode } from '@/lib/api/brain'

export const pinSchema = z.object({
  id:     z.string(),
  title:  z.string(),
  source: z.string().optional(),
})
export type Pin = z.infer<typeof pinSchema>

export const fileRefSchema = z.object({
  name: z.string(),
  meta: z.string().optional(),
})
export type FileRef = z.infer<typeof fileRefSchema>

export const personaSchema = z.object({
  id:     z.string(),
  name:   z.string(),
  handle: z.string().optional(),
  avatar: z.string().optional(),
})
export type Persona = z.infer<typeof personaSchema>

export const nodeModelSchema = z.object({
  id:      z.string(),
  name:    z.string().optional(),
  company: z.string().optional(),
})
export type NodeModel = z.infer<typeof nodeModelSchema>

export const nodeContextSchema = z.object({
  connectors: connectorSchema.array(),
  pins:       pinSchema.array(),
  files:      fileRefSchema.array(),
})
export type NodeContext = z.infer<typeof nodeContextSchema>

export const planNodeSchema = z.object({
  id:         z.string(),
  task:       z.string(),
  label:      z.string(),
  persona:    personaSchema.nullable(),
  model:      nodeModelSchema.nullable(),
  context:    nodeContextSchema,
  isCritical: z.boolean(),
})
export type PlanNode = z.infer<typeof planNodeSchema>

export const stepStatusSchema = z.enum([
  'pending', 'upcoming', 'executing', 'complete', 'failed', 'skipped',
])
export type StepStatus = z.infer<typeof stepStatusSchema>

export const activityNodeSchema = planNodeSchema.extend({
  status:         stepStatusSchema,
  startedAt:      z.string().nullable(),
  completedAt:    z.string().nullable(),
  resultPreview:  z.string().nullable(),
  error:          z.string().nullable(),
  streamDetail:   z.string().nullable(),
  usedConnectors: z.array(z.string()),
})
export type ActivityNode = z.infer<typeof activityNodeSchema>

export const edgeSchema = z.object({
  from: z.string(),
  to:   z.string(),
})
export type Edge = z.infer<typeof edgeSchema>

export const planSchema = z.object({
  summary: z.string(),
  nodes:   planNodeSchema.array(),
  edges:   edgeSchema.array(),
})
export type Plan = z.infer<typeof planSchema>

export const activityPlanSchema = planSchema.extend({
  nodes: activityNodeSchema.array(),
})
export type ActivityPlan = z.infer<typeof activityPlanSchema>

export const contextPanelSchema = z.object({
  persona:    personaSchema.nullable(),
  connectors: connectorSchema.array(),
  pins:       pinSchema.array(),
  files:      fileRefSchema.array(),
})
export type ContextPanel = z.infer<typeof contextPanelSchema>

export interface RunViewResolvers {
  persona?: (id: string) => Persona | null
  model?:   (id: string) => NodeModel | null
  pin?:     (id: string) => Pin | null
}

export interface RuntimeOverlay {
  statusById?: Record<string, StepStatus | undefined>
  outputById?: Record<string, string | undefined>
  detailById?: Record<string, string | undefined>
  usedById?:   Record<string, string[] | undefined>
}

export interface PlanInput {
  summary?: string
  steps?:   unknown
  nodes?:   unknown
  edges?:   unknown
}

function firstLine(task: string): string {
  const line = task.trim().split('\n')[0]
  return line || 'Step'
}

function toStepStatus(status: string | undefined): StepStatus {
  switch (status) {
    case 'running':
    case 'executing': return 'executing'
    case 'completed':
    case 'complete':  return 'complete'
    case 'failed':    return 'failed'
    case 'skipped':   return 'skipped'
    case 'upcoming':  return 'upcoming'
    default:          return 'pending'
  }
}

function toEdges(edges: unknown): Edge[] {
  if (!Array.isArray(edges)) return []
  return edges.flatMap((edge) => {
    const parsed = edgeSchema.safeParse(edge)
    return parsed.success ? [parsed.data] : []
  })
}

export function toPlanNode(node: BackendPlanNode, resolvers: RunViewResolvers = {}): PlanNode {
  const persona = node.persona_id
    ? resolvers.persona?.(node.persona_id) ?? { id: node.persona_id, name: 'Agent' }
    : null
  const model = node.model_id
    ? resolvers.model?.(node.model_id) ?? { id: node.model_id }
    : null
  const connectors = (node.context?.connectors ?? []).map((slug) => toConnector(slug))
  const pins  = (node.context?.pins ?? []).map((id) => resolvers.pin?.(id) ?? { id, title: id })
  const files = (node.context?.files ?? []).map((name) => ({ name }))

  return planNodeSchema.parse({
    id:         node.id,
    task:       node.task,
    label:      firstLine(node.task),
    persona,
    model,
    context:    { connectors, pins, files },
    isCritical: node.is_critical ?? false,
  })
}

export function toActivityNode(
  node: BackendPlanNode,
  resolvers: RunViewResolvers = {},
  live: { status?: StepStatus; output?: string; detail?: string; used?: string[] } = {},
): ActivityNode {
  return activityNodeSchema.parse({
    ...toPlanNode(node, resolvers),
    status:         live.status ?? toStepStatus(node.status),
    startedAt:      node.started_at ?? null,
    completedAt:    node.completed_at ?? null,
    resultPreview:  live.output ?? node.result_preview ?? null,
    error:          node.error ?? null,
    streamDetail:   live.detail ?? null,
    usedConnectors: live.used ?? [],
  })
}

export function toPlan(input: PlanInput, resolvers: RunViewResolvers = {}): Plan {
  const nodes = parsePlanNodes(input.nodes ?? input.steps)
  return planSchema.parse({
    summary: input.summary ?? '',
    nodes:   nodes.map((node) => toPlanNode(node, resolvers)),
    edges:   toEdges(input.edges),
  })
}

export function toActivityPlan(
  input: PlanInput,
  resolvers: RunViewResolvers = {},
  overlay: RuntimeOverlay = {},
): ActivityPlan {
  const nodes = parsePlanNodes(input.nodes ?? input.steps)
  return activityPlanSchema.parse({
    summary: input.summary ?? '',
    nodes:   nodes.map((node) => toActivityNode(node, resolvers, {
      status: overlay.statusById?.[node.id],
      output: overlay.outputById?.[node.id],
      detail: overlay.detailById?.[node.id],
      used:   overlay.usedById?.[node.id],
    })),
    edges:   toEdges(input.edges),
  })
}

export function rollupContext(plan: Plan | ActivityPlan): ContextPanel {
  const connectors = new Map<string, Connector>()
  const pins       = new Map<string, Pin>()
  const files      = new Map<string, FileRef>()
  let persona: Persona | null = null

  for (const node of plan.nodes) {
    if (!persona && node.persona) persona = node.persona
    for (const connector of node.context.connectors) connectors.set(connector.slug, connector)
    for (const pin of node.context.pins) pins.set(pin.id, pin)
    for (const file of node.context.files) files.set(file.name, file)
  }

  return contextPanelSchema.parse({
    persona,
    connectors: [...connectors.values()],
    pins:       [...pins.values()],
    files:      [...files.values()],
  })
}
