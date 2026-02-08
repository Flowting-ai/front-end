import { Node, Edge } from 'reactflow';

export type NodeType = 'start' | 'end' | 'document' | 'chat' | 'pin' | 'persona' | 'model' | 'phantom';

export type NodeCategory = 'context' | 'reasoning' | 'control';

export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

export type ExecutionMode = 'test' | 'production';

// File interface for document nodes (optimized for backend)
export interface WorkflowFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string; // Frontend only - blob URL
  fileId?: string; // Backend reference
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  type: NodeType;
  status: NodeStatus;
  config?: Record<string, any>;
  files?: WorkflowFile[];
  prompt?: string;
  systemPrompt?: string;
  userPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  output?: any;
  isHighlighted?: boolean;
  instructions?: string;
  name?: string; // Node name for inspectors
  selectedChats?: string; // Chat ID for chat node (single selection)
  selectedPins?: string[]; // Pin IDs for pin nodes
  selectedPersona?: string; // Persona ID for persona nodes
  selectedModel?: string; // Model ID for model nodes
  personaData?: { // Full persona data for display
    name: string;
    image?: string;
    description?: string;
  };
  modelData?: { // Full model data for display
    name: string;
    logo?: string;
    description?: string;
    companyName?: string; // For getModelIcon()
    sdkLibrary?: string; // For getModelIcon()
  };
  knowledgeContext?: Record<string, string>; // Preprocessed KB content by kb_id
  onOpenInstructions?: () => void; // Frontend only
  executionOrder?: number; // Track execution sequence
  processingTime?: number; // Track performance
}

export type WorkflowNode = Node<WorkflowNodeData>;

export type WorkflowEdge = Edge;

// Preprocessed knowledge base item from backend
export interface PreprocessedKnowledgeItem {
  kb_type: 'chat' | 'pin';
  instruction?: string;
  context?: string;
  position_x?: number;
  position_y?: number;
  node_id?: string;
}

// Backend API Types
export interface WorkflowDTO {
  id?: string;
  name: string;
  description?: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  viewport?: { x: number; y: number; zoom: number };
  version?: number;
  tags?: string[];
  isPublic?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  preprocessedKnowledge?: Record<string, PreprocessedKnowledgeItem>;
}

// Serialized node for backend (excludes frontend-only props)
export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Omit<WorkflowNodeData, 'isHighlighted' | 'onOpenInstructions'>;
}

// Serialized edge for backend
export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
}

// Execution result from backend
export interface ExecutionResult {
  workflowId?: string;
  executionId?: string;
  runId?: string;
  status: 'success' | 'error' | 'partial' | 'pending' | 'running' | 'completed' | 'failed' | string;
  finalOutput?: string;
  totalCost?: number;
  executionMetadata?: Record<string, any>;
  nodeResults?: Record<string, NodeExecutionResult>;
  startTime?: string;
  endTime?: string;
  totalDuration?: number;
  error?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeStatus;
  output: any;
  processingTime: number;
  error?: string;
  timestamp: string;
}

// Workflow metadata for listing
export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  edgeCount: number;
  lastExecuted?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  isPublic: boolean;
  isActive?: boolean;
  runsCount?: number;
}

export interface NodePaletteItem {
  type: NodeType;
  label: string;
  icon: React.ComponentType<any>;
  category: NodeCategory;
  description: string;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode?: (type: NodeType) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onGroup?: () => void;
  onResetPosition?: () => void;
  selectedNodeId?: string | null;
}

export interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  workflowName: string;
  lastSaved: Date | null;
  history: Array<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>;
  historyIndex: number;
}

// Serialization helpers for backend communication
export const serializeWorkflow = (
  name: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  viewport?: { x: number; y: number; zoom: number }
): WorkflowDTO => {
  return {
    name,
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type || 'custom',
      position: node.position,
      data: {
        ...node.data,
        isHighlighted: undefined,
        onOpenInstructions: undefined,
      } as any,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
    })),
    viewport,
  };
};

export const deserializeWorkflow = (dto: WorkflowDTO): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
} => {
  return {
    nodes: dto.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: dto.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
    })),
    viewport: dto.viewport,
  };
};
