// ── canvas/ ──────────────────────────────────────────────────────────────────
export { default as WorkflowCanvas } from './canvas/WorkflowCanvas';
export { default as CustomNode } from './canvas/CustomNode';
export { default as CustomEdge } from './canvas/CustomEdge';
export { default as ContextMenu } from './canvas/ContextMenu';
export { default as UtilitySection } from './canvas/UtilitySection';
export { default as Footer } from './canvas/Footer';

// ── inspectors/ ──────────────────────────────────────────────────────────────
export { DocumentNodeInspector } from './inspectors/DocumentNodeInspector';
export { ChatNodeInspector } from './inspectors/ChatNodeInspector';
export { PinNodeInspector } from './inspectors/PinNodeInspector';
export { PersonaNodeInspector } from './inspectors/PersonaNodeInspector';
export { ModelNodeInspector } from './inspectors/ModelNodeInspector';

// ── dialogs/ ─────────────────────────────────────────────────────────────────
export { SelectChatsDialog } from './dialogs/SelectChatsDialog';
export { SelectPinsDialog } from './dialogs/SelectPinsDialog';
export { AddPersonaDialog } from './dialogs/AddPersonaDialog';
export { SelectModelDialog } from './dialogs/SelectModelDialog';
export { LoadWorkflowDialog } from './dialogs/LoadWorkflowDialog';
export { EdgeDetailsDialog } from './dialogs/EdgeDetailsDialog';

// ── chat/ ─────────────────────────────────────────────────────────────────────
export { WorkflowChat } from './chat/WorkflowChat';
export type { WorkflowChatProps } from './chat/WorkflowChat';

// ── root (page-level layout + shared utilities) ───────────────────────────────
export { default as TopBar } from './TopBar';
export { default as LeftSidebar } from './LeftSidebar';
export * from './types';
export * from './workflow-utils';
export { workflowAPI } from './workflow-api';
