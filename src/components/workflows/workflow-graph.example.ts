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
    },
    {
      kb_type: 'pin',
      kb_id: 'pin-xyz789',
      instruction: 'Reference these brand guidelines',
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

console.log('\n' + '='.repeat(60));
console.log('STEP 3: ADJACENCY LIST (Reasoning Nodes Only)');
console.log('='.repeat(60));

const { list, inDegree } = buildAdjacencyList(graph);

console.log('\nAdjacency List:');
list.forEach((targets, source) => {
  console.log(`  ${source} → [${targets.join(', ') || 'none'}]`);
});

console.log('\nIn-Degree:');
inDegree.forEach((degree, nodeId) => {
  console.log(`  ${nodeId}: ${degree}`);
});

// =============================================================================
// STEP 4: TOPOLOGICAL SORT (EXECUTION ORDER)
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log('STEP 4: EXECUTION ORDER');
console.log('='.repeat(60));

const executionOrder = topologicalSort(graph);
if (executionOrder) {
  console.log('\nExecution order:');
  executionOrder.forEach((nodeId, index) => {
    const node = graph.nodes.find(n => n.node_id === nodeId);
    const type = node?.persona_id ? 'persona' : 'model';
    const refId = node?.persona_id || node?.model_id;
    console.log(`  ${index + 1}. [${type}] ${refId}`);
  });
} else {
  console.log('\nERROR: Graph contains cycles!');
}

// =============================================================================
// STEP 5: VALIDATE GRAPH
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log('STEP 5: VALIDATION');
console.log('='.repeat(60));

const validation = validateGraph(graph);
console.log(`\nValid: ${validation.valid}`);
if (validation.errors.length > 0) {
  console.log('Errors:');
  validation.errors.forEach(err => console.log(`  - ${err}`));
}

// =============================================================================
// STEP 6: TRANSFORM TO BACKEND PAYLOAD
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log('STEP 6: BACKEND PAYLOAD');
console.log('='.repeat(60));

const backendPayload = toBackendPayload(
  graph,
  'Marketing Content Workflow',
  'Generate marketing content using brand guidelines'
);

console.log('\n📤 SENDING TO BACKEND:\n');
console.log(JSON.stringify(backendPayload, null, 2));

// =============================================================================
// VISUAL SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log('VISUAL SUMMARY');
console.log('='.repeat(60));

printGraph(graph);
