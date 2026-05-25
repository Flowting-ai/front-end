// Split docs/openapi/openapi.yaml into per-tag yamls under docs/openapi/api_yaml/.
// Each output file contains: openapi/info header, all paths with the given tag,
// and only the schemas those paths transitively reference.

import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

const ROOT = path.resolve(process.cwd())
const SRC  = path.join(ROOT, 'docs/openapi/openapi.yaml')
const OUT  = path.join(ROOT, 'docs/openapi/api_yaml')

const spec = yaml.load(fs.readFileSync(SRC, 'utf8'))

// Map tag → friendly title + output filename
const TAG_FILES = {
  brain:              'brain.yaml',
  chat:               'chat.yaml',
  highlights:         'highlights.yaml',
  llm:                'llm.yaml',
  persona:            'persona.yaml',
  pins:               'pins.yaml',
  projects:           'projects.yaml',
  stripe:             'stripe.yaml',
  users:              'users.yaml',
  connectors:         'connectors.yaml',
  'scheduled-tasks':  'scheduled-tasks.yaml',
}

const TAG_TITLES = {
  brain:             'Brain',
  chat:              'Chat',
  highlights:        'Highlights',
  llm:               'LLM',
  persona:           'Persona',
  pins:              'Pins',
  projects:          'Projects',
  stripe:            'Stripe',
  users:             'Users',
  connectors:        'Connectors',
  'scheduled-tasks': 'Scheduled Tasks',
}

// Walk an object collecting every $ref schema name.
function collectRefs(node, refs) {
  if (node == null) return
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs)
    return
  }
  if (typeof node !== 'object') return
  for (const [k, v] of Object.entries(node)) {
    if (k === '$ref' && typeof v === 'string') {
      const m = /^#\/components\/schemas\/(.+)$/.exec(v)
      if (m) refs.add(m[1])
    } else {
      collectRefs(v, refs)
    }
  }
}

// Resolve a schema's transitive refs into a flat set.
function resolveTransitiveRefs(schemas, seed) {
  const out  = new Set(seed)
  const todo = [...seed]
  while (todo.length > 0) {
    const name = todo.pop()
    const s    = schemas[name]
    if (!s) continue
    const refs = new Set()
    collectRefs(s, refs)
    for (const r of refs) {
      if (!out.has(r)) { out.add(r); todo.push(r) }
    }
  }
  return out
}

fs.mkdirSync(OUT, { recursive: true })

const allSchemas = spec.components?.schemas ?? {}

for (const [tag, filename] of Object.entries(TAG_FILES)) {
  // Paths whose first method's tags include this tag
  const pickedPaths = {}
  for (const [p, ops] of Object.entries(spec.paths ?? {})) {
    const tagsInPath = new Set()
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op !== 'object' || op == null) continue
      for (const t of op.tags ?? []) tagsInPath.add(t)
    }
    if (tagsInPath.has(tag)) pickedPaths[p] = ops
  }

  if (Object.keys(pickedPaths).length === 0) {
    console.warn(`[split] no paths found for tag '${tag}' — skipping`)
    continue
  }

  // Collect schema refs starting from the paths
  const initialRefs = new Set()
  collectRefs(pickedPaths, initialRefs)
  const allRefs    = resolveTransitiveRefs(allSchemas, initialRefs)

  const pickedSchemas = {}
  // Preserve original insertion order
  for (const name of Object.keys(allSchemas)) {
    if (allRefs.has(name)) pickedSchemas[name] = allSchemas[name]
  }

  const doc = {
    openapi: spec.openapi,
    info: {
      title:   `FastAPI - ${TAG_TITLES[tag]}`,
      version: spec.info?.version ?? '0.1.0',
    },
    paths: pickedPaths,
    components: {
      schemas: pickedSchemas,
      ...(spec.components?.securitySchemes
        ? { securitySchemes: spec.components.securitySchemes }
        : {}),
    },
  }

  const outPath = path.join(OUT, filename)
  fs.writeFileSync(outPath, yaml.dump(doc, { lineWidth: 120, noRefs: true }))
  console.log(`[split] wrote ${filename}  (${Object.keys(pickedPaths).length} paths, ${Object.keys(pickedSchemas).length} schemas)`)
}
