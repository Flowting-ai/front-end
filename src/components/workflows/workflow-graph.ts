/**
 * Refined Workflow Graph Implementation
 *
 * Core graph structure:
 * - Nodes with UUID, persona_id OR model_id, knowledge_bases
 * - Adjacency list built only from reasoning nodes
 * - Clean transformation to backend payload
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export type NodeType = 'start' | 'end' | 'process';

export interface KnowledgeBaseItem {
  kb_type: 'chat' | 'pin';
  kb_id: string;
  instruction?: string;
}

export interface WorkflowNode {
  node_id: string;                        // UUID
  node_type: NodeType;
  position: { x: number; y: number };

  // Only for 'process' nodes - mutually exclusive
  persona_id?: string;
  model_id?: string;

  // Knowledge bases with per-item instructions
  knowledge_bases: KnowledgeBaseItem[];
}

export interface WorkflowEdge {
  source: string;  // source node_id
  target: string;  // target node_id
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// =============================================================================
// NODE CREATION HELPERS
// =============================================================================

export const createStartNode = (position: { x: number; y: number }): WorkflowNode => ({
  node_id: uuidv4(),
  node_type: 'start',
  position,
  knowledge_bases: [],
});

export const createEndNode = (position: { x: number; y: number }): WorkflowNode => ({
  node_id: uuidv4(),
  node_type: 'end',
  position,
  knowledge_bases: [],
});

export const createPersonaNode = (
  position: { x: number; y: number },
  persona_id: string,
  knowledge_bases: KnowledgeBaseItem[] = []
): WorkflowNode => ({
  node_id: uuidv4(),
  node_type: 'process',
  position,
  persona_id,
  knowledge_bases,
});

export const createModelNode = (
  position: { x: number; y: number },
  model_id: string,
  knowledge_bases: KnowledgeBaseItem[] = []
): WorkflowNode => ({
  node_id: uuidv4(),
  node_type: 'process',
  position,
  model_id,
  knowledge_bases,
});

// =============================================================================
// ADJACENCY LIST (REASONING NODES ONLY)
// =============================================================================

export interface AdjacencyList {
  list: Map<string, string[]>;
  inDegree: Map<string, number>;
}

export const buildAdjacencyList = (graph: WorkflowGraph): AdjacencyList => {
  const { nodes, edges } = graph;

  // Filter to only reasoning nodes (process type)
  const reasoningNodes = nodes.filter(n => n.node_type === 'process');
  const reasoningNodeIds = new Set(reasoningNodes.map(n => n.node_id));

  // Initialize adjacency list and in-degree for reasoning nodes
  const list = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  reasoningNodes.forEach(node => {
    list.set(node.node_id, []);
    inDegree.set(node.node_id, 0);
  });

  // Build edges - only between reasoning nodes
  edges.forEach(edge => {
    const sourceIsReasoning = reasoningNodeIds.has(edge.source);
    const targetIsReasoning = reasoningNodeIds.has(edge.target);

    if (sourceIsReasoning && targetIsReasoning) {
      list.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  return { list, inDegree };
};

// =============================================================================
// TOPOLOGICAL SORT (FOR EXECUTION ORDER)
// =============================================================================

export const topologicalSort = (graph: WorkflowGraph): string[] | null => {
  const { list, inDegree } = buildAdjacencyList(graph);

  // Kahn's algorithm
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    list.get(current)?.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Check for cycles - if we couldn't sort all nodes, there's a cycle
  const reasoningNodeCount = Array.from(list.keys()).length;
  return sorted.length === reasoningNodeCount ? sorted : null;
};

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateGraph = (graph: WorkflowGraph): ValidationResult => {
  const errors: string[] = [];
  const { nodes, edges } = graph;

  // Must have start node
  const startNode = nodes.find(n => n.node_type === 'start');
  if (!startNode) {
    errors.push('Workflow must have a start node');
  }

  // Must have end node
  const endNode = nodes.find(n => n.node_type === 'end');
  if (!endNode) {
    errors.push('Workflow must have an end node');
  }

  // Check for cycles in reasoning nodes
  const sortResult = topologicalSort(graph);
  if (sortResult === null) {
    errors.push('Workflow contains cycles in reasoning nodes');
  }

  // Process nodes must have either persona_id or model_id (not both, not neither)
  nodes.filter(n => n.node_type === 'process').forEach(node => {
    const hasPersona = !!node.persona_id;
    const hasModel = !!node.model_id;

    if (!hasPersona && !hasModel) {
      errors.push(`Process node ${node.node_id} must have either persona_id or model_id`);
    }
    if (hasPersona && hasModel) {
      errors.push(`Process node ${node.node_id} cannot have both persona_id and model_id`);
    }
  });

  // Validate knowledge base items
  nodes.forEach(node => {
    node.knowledge_bases.forEach((kb, index) => {
      if (!kb.kb_id) {
        errors.push(`Node ${node.node_id} has invalid knowledge_base at index ${index}: missing kb_id`);
      }
      if (kb.kb_type !== 'chat' && kb.kb_type !== 'pin') {
        errors.push(`Node ${node.node_id} has invalid kb_type: ${kb.kb_type}`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

// =============================================================================
// BACKEND PAYLOAD TRANSFORMATION
// =============================================================================

export interface BackendNode {
  node_id: string;
  node_type: 'start' | 'end' | 'process';
  position_x: number;
  position_y: number;
  persona_id?: string;
  model_id?: string;
  knowledge_bases?: Array<{
    kb_type: 'chat' | 'pin';
    kb_id: string;
    instruction?: string;
  }>;
}

export interface BackendEdge {
  source_node_id: string;
  target_node_id: string;
}

export interface BackendPayload {
  name: string;
  description?: string;
  nodes: BackendNode[];
  edges: BackendEdge[];
}

export const toBackendPayload = (
  graph: WorkflowGraph,
  name: string,
  description?: string
): BackendPayload => {
  const { nodes, edges } = graph;

  // Get reasoning node IDs for filtering edges
  const reasoningNodeIds = new Set(
    nodes.filter(n => n.node_type === 'process').map(n => n.node_id)
  );

  // Transform nodes
  const backendNodes: BackendNode[] = nodes.map(node => {
    const backendNode: BackendNode = {
      node_id: node.node_id,
      node_type: node.node_type,
      position_x: node.position.x,
      position_y: node.position.y,
    };

    // Add persona_id or model_id for process nodes
    if (node.node_type === 'process') {
      if (node.persona_id) {
        backendNode.persona_id = node.persona_id;
      }
      if (node.model_id) {
        backendNode.model_id = node.model_id;
      }

      // Add knowledge bases if present
      if (node.knowledge_bases.length > 0) {
        backendNode.knowledge_bases = node.knowledge_bases.map(kb => ({
          kb_type: kb.kb_type,
          kb_id: kb.kb_id,
          ...(kb.instruction && { instruction: kb.instruction }),
        }));
      }
    }

    return backendNode;
  });

  // Transform edges - only between reasoning nodes
  const backendEdges: BackendEdge[] = edges
    .filter(edge =>
      reasoningNodeIds.has(edge.source) && reasoningNodeIds.has(edge.target)
    )
    .map(edge => ({
      source_node_id: edge.source,
      target_node_id: edge.target,
    }));

  return {
    name: name.trim() || 'Untitled Workflow',
    ...(description && { description: description.trim() }),
    nodes: backendNodes,
    edges: backendEdges,
  };
};

// =============================================================================
// UTILITY: PRINT GRAPH (FOR DEBUGGING)
// =============================================================================

export const printGraph = (graph: WorkflowGraph): void => {
  console.log('\n=== WORKFLOW GRAPH ===\n');

  console.log('NODES:');
  graph.nodes.forEach(node => {
    const type = node.node_type === 'process'
      ? (node.persona_id ? 'persona' : 'model')
      : node.node_type;
    const id = node.persona_id || node.model_id || '-';
    console.log(`  [${node.node_id.slice(0, 8)}] ${type} (${id})`);

    if (node.knowledge_bases.length > 0) {
      node.knowledge_bases.forEach(kb => {
        console.log(`    └─ ${kb.kb_type}: ${kb.kb_id} ${kb.instruction ? `"${kb.instruction}"` : ''}`);
      });
    }
  });

  console.log('\nADJACENCY LIST (Reasoning Nodes Only):');
  const { list } = buildAdjacencyList(graph);
  list.forEach((targets, source) => {
    const targetStr = targets.length > 0
      ? targets.map(t => t.slice(0, 8)).join(', ')
      : '(none)';
    console.log(`  ${source.slice(0, 8)} → [${targetStr}]`);
  });

  console.log('\nEXECUTION ORDER:');
  const order = topologicalSort(graph);
  if (order) {
    console.log(`  ${order.map(id => id.slice(0, 8)).join(' → ')}`);
  } else {
    console.log('  ERROR: Cycle detected!');
  }

  console.log('\n');
};
