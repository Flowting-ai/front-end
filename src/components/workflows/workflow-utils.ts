import { WorkflowNode, WorkflowEdge, WorkflowDTO, NodeStatus, serializeWorkflow, deserializeWorkflow } from './types';

// Debounce utility for auto-save optimization
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Topological sort for DAG execution (optimized version)
export const topologicalSort = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] | null => {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  nodes.forEach(node => {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  // Build graph
  edges.forEach(edge => {
    adjList.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Kahn's algorithm
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    adjList.get(current)?.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Cycle detection
  return sorted.length === nodes.length ? sorted : null;
};

// Validate workflow structure
export const validateWorkflow = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for start node
  const hasStart = nodes.some(n => n.data.type === 'start');
  if (!hasStart) {
    errors.push('Workflow must have a start node');
  }

  // Check for end node
  const hasEnd = nodes.some(n => n.data.type === 'end');
  if (!hasEnd) {
    errors.push('Workflow must have an end node');
  }

  // Check for cycles
  const sorted = topologicalSort(nodes, edges);
  if (!sorted) {
    errors.push('Workflow contains cycles');
  }

  // Check for direct Start → End connection
  const startNode = nodes.find(n => n.data.type === 'start');
  const endNode = nodes.find(n => n.data.type === 'end');
  
  if (startNode && endNode) {
    const directConnection = edges.some(
      edge => edge.source === startNode.id && edge.target === endNode.id
    );
    if (directConnection) {
      errors.push('Cannot connect Start directly to End. Add intermediate nodes.');
    }
  }

  // Check for context nodes connecting directly to End node
  if (endNode) {
    const contextNodes = nodes.filter(n => 
      ['document', 'chat', 'pin'].includes(n.data.type as string)
    );
    
    contextNodes.forEach(contextNode => {
      const directConnection = edges.some(
        edge => edge.source === contextNode.id && edge.target === endNode.id
      );
      if (directConnection) {
        errors.push(`Cannot connect ${contextNode.data.type} node directly to End. Context nodes must connect through reasoning nodes (persona or model).`);
      }
    });
  }

  // Check for disconnected nodes
  const connectedNodes = new Set<string>();
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  if (startNode && !connectedNodes.has(startNode.id) && nodes.length > 1) {
    errors.push('Start node is not connected');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Get node category helper
export const getNodeCategory = (nodeType: string): 'context' | 'reasoning' | 'control' => {
  if (['document', 'chat', 'pin'].includes(nodeType)) return 'context';
  if (['persona', 'model'].includes(nodeType)) return 'reasoning';
  return 'control';
};

// Validate connection with cycle detection
export const isValidConnection = (
  sourceType: string,
  targetType: string,
  nodes?: WorkflowNode[],
  edges?: WorkflowEdge[],
  sourceId?: string | null,
  targetId?: string | null
): boolean => {
  const sourceCategory = getNodeCategory(sourceType);
  const targetCategory = getNodeCategory(targetType);

  // Disallow direct Start → End connection
  if (sourceType === 'start' && targetType === 'end') {
    return false;
  }

  // Disallow End → Start connection (if End somehow has outgoing handles)
  if (sourceType === 'end' && targetType === 'start') {
    return false;
  }

  // Disallow context nodes (document, chat, pin) connecting directly to End node
  if (sourceCategory === 'context' && targetType === 'end') {
    return false;
  }

  // Context nodes (document, chat, pin) are source-only - cannot receive connections
  if (targetCategory === 'context') {
    return false;
  }

  // Prevent cycles in persona/model connections
  // If connecting model -> persona, check if it would create a cycle
  if (nodes && edges && sourceId && targetId) {
    if (sourceType === 'model' && targetType === 'persona') {
      // Check if there's already a path from the target persona back to this model
      if (hasPath(targetId, sourceId, edges)) {
        return false; // Would create a cycle
      }
    }
    
    // Similarly for persona -> model, though this is generally allowed
    // But we still prevent it if it would create a cycle
    if (sourceType === 'persona' && targetType === 'model') {
      if (hasPath(targetId, sourceId, edges)) {
        return false; // Would create a cycle
      }
    }
  }

  return true;
};

// Helper function to check if there's a path from node A to node B
const hasPath = (
  startId: string,
  endId: string,
  edges: WorkflowEdge[]
): boolean => {
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) return true;
    if (visited.has(current)) continue;
    
    visited.add(current);
    
    // Find all outgoing edges from current node
    edges.forEach(edge => {
      if (edge.source === current && !visited.has(edge.target)) {
        queue.push(edge.target);
      }
    });
  }

  return false;
};

// Calculate workflow metrics
export const calculateMetrics = (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
  const contextNodes = nodes.filter(n => getNodeCategory(n.data.type) === 'context').length;
  const reasoningNodes = nodes.filter(n => getNodeCategory(n.data.type) === 'reasoning').length;
  const controlNodes = nodes.filter(n => getNodeCategory(n.data.type) === 'control').length;

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    contextNodes,
    reasoningNodes,
    controlNodes,
    complexity: edges.length / Math.max(nodes.length, 1),
  };
};

// Local storage helpers (for offline persistence)
const STORAGE_KEY = 'workflow_drafts';

export const saveToLocalStorage = (workflowId: string, data: WorkflowDTO) => {
  try {
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    drafts[workflowId] = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to save to local storage:', error);
  }
};

export const loadFromLocalStorage = (workflowId: string): WorkflowDTO | null => {
  try {
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return drafts[workflowId] || null;
  } catch (error) {
    console.error('Failed to load from local storage:', error);
    return null;
  }
};

export const clearLocalStorage = (workflowId: string) => {
  try {
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete drafts[workflowId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to clear local storage:', error);
  }
};

// Optimize history by limiting size
export const pruneHistory = <T>(
  history: T[],
  maxSize: number = 50
): T[] => {
  if (history.length <= maxSize) return history;
  // Keep most recent entries
  return history.slice(-maxSize);
};
