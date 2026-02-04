import { Node, Edge } from 'reactflow';

export type NodeType = 'document' | 'chat' | 'pin' | 'persona' | 'model';

export type NodeCategory = 'context' | 'reasoning';

export interface WorkflowNodeData {
  label: string;
  description?: string;
  type: NodeType;
  status: 'idle' | 'running' | 'success' | 'error';
  config?: Record<string, any>;
  files?: Array<{ name: string; size: number; url: string }>;
  prompt?: string;
  systemPrompt?: string;
  userPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  output?: any;
  isHighlighted?: boolean;
}

export type WorkflowNode = Node<WorkflowNodeData>;

export type WorkflowEdge = Edge;

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  createdAt: string;
  updatedAt: string;
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
