/**
 * Example: Full workflow graph flow from creation to backend payload
 *
 * Run this to see exactly what gets sent to the backend:
 * npx ts-node src/components/workflows/workflow-graph.example.ts
 */

import {
  WorkflowGraph,
  WorkflowNode,
  createStartNode,
  createEndNode,
  createPersonaNode,
  createModelNode,
  buildAdjacencyList,
  topologicalSort,
  validateGraph,
  toBackendPayload,
  printGraph,
} from './workflow-graph';

// =============================================================================
// STEP 1: CREATE NODES
// =============================================================================

const startNode = createStartNode({ x: 0, y: 200 });

const personaNode = createPersonaNode(
  { x: 200, y: 100 },
  'persona-marketing-expert',
  [
    {
      kb_type: 'chat',
      kb_id: 'chat-abc123',
      instruction: 'Use this conversation as context for tone',
      position_x: 50,
      position_y: 50,
    },
    {
      kb_type: 'pin',
      kb_id: 'pin-xyz789',
      instruction: 'Reference these brand guidelines',
      position_x: 50,
      position_y: 150,
    },
  ]
);

const modelNode = createModelNode(
  { x: 400, y: 200 },
  'gpt-4-turbo',
  [
    {
      kb_type: 'chat',
      kb_id: 'chat-def456',
      instruction: 'Use as examples for output format',
      position_x: 250,
      position_y: 300,
    },
  ]
);

const endNode = createEndNode({ x: 600, y: 200 });

// =============================================================================
// STEP 2: CREATE GRAPH WITH EDGES
// =============================================================================

const graph: WorkflowGraph = {
  nodes: [startNode, personaNode, modelNode, endNode],
  edges: [
    { source: startNode.node_id, target: personaNode.node_id },
    { source: personaNode.node_id, target: modelNode.node_id },
    { source: modelNode.node_id, target: endNode.node_id },
  ],
};

// =============================================================================
// STEP 3: BUILD ADJACENCY LIST (REASONING NODES ONLY)
// =============================================================================

console.debug('\n' + '='.repeat(60));
console.debug('STEP 3: ADJACENCY LIST (Reasoning Nodes Only)');
console.debug('='.repeat(60));

const { list, inDegree } = buildAdjacencyList(graph);

console.debug('\nAdjacency List:');
list.forEach((targets, source) => {
  console.debug(`  ${source} → [${targets.join(', ') || 'none'}]`);
});

console.debug('\nIn-Degree:');
inDegree.forEach((degree, nodeId) => {
  console.debug(`  ${nodeId}: ${degree}`);
});

// =============================================================================
// STEP 4: TOPOLOGICAL SORT (EXECUTION ORDER)
// =============================================================================

console.debug('\n' + '='.repeat(60));
console.debug('STEP 4: EXECUTION ORDER');
console.debug('='.repeat(60));

const executionOrder = topologicalSort(graph);
if (executionOrder) {
  console.debug('\nExecution order:');
  executionOrder.forEach((nodeId, index) => {
    const node = graph.nodes.find(n => n.node_id === nodeId);
    const type = node?.persona_id ? 'persona' : 'model';
    const refId = node?.persona_id || node?.model_id;
    console.debug(`  ${index + 1}. [${type}] ${refId}`);
  });
} else {
  console.debug('\nERROR: Graph contains cycles!');
}

// =============================================================================
// STEP 5: VALIDATE GRAPH
// =============================================================================

console.debug('\n' + '='.repeat(60));
console.debug('STEP 5: VALIDATION');
console.debug('='.repeat(60));

const validation = validateGraph(graph);
console.debug(`\nValid: ${validation.valid}`);
if (validation.errors.length > 0) {
  console.debug('Errors:');
  validation.errors.forEach(err => console.debug(`  - ${err}`));
}

// =============================================================================
// STEP 6: TRANSFORM TO BACKEND PAYLOAD
// =============================================================================

console.debug('\n' + '='.repeat(60));
console.debug('STEP 6: BACKEND PAYLOAD');
console.debug('='.repeat(60));

const backendPayload = toBackendPayload(
  graph,
  'Marketing Content Workflow',
  'Generate marketing content using brand guidelines'
);

console.debug('\n📤 SENDING TO BACKEND:\n');
console.debug(JSON.stringify(backendPayload, null, 2));

// =============================================================================
// VISUAL SUMMARY
// =============================================================================

console.debug('\n' + '='.repeat(60));
console.debug('VISUAL SUMMARY');
console.debug('='.repeat(60));

printGraph(graph);
