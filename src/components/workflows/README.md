# Workflow System - Production Ready

## Overview
A scalable, production-ready visual workflow builder for creating and executing AI-powered workflows. Built with React Flow, TypeScript, and optimized for performance and backend integration.

## Architecture

### Core Components
- **WorkflowCanvas.tsx** - Main canvas container with state management and execution logic
- **CustomNode.tsx** - Reusable node component with type-specific rendering (280x88px standardized)
- **TopBar.tsx** - Workflow controls (run, reset, share, name editing)
- **LeftSidebar.tsx** - Node palette for dragging new nodes
- **RightInspector.tsx** - Node property inspector
- **DocumentNodeInspector.tsx** - Specialized inspector for document nodes with file uploads
- **ContextMenu.tsx** - Right-click context menu for canvas operations
- **UtilitySection.tsx** - Canvas utilities (zoom, pan, minimap toggles)
- **Footer.tsx** - Workflow metrics display

### Core Files
- **types.ts** - Complete TypeScript type definitions with backend DTOs
- **workflow-utils.ts** - Utility functions (validation, topological sort, debounce, localStorage)
- **workflow-api.ts** - Backend API client for CRUD operations and execution

## Features

### 1. Visual Workflow Builder
- Infinite drag-and-drop canvas with React Flow
- Connection validation with type checking
- Real-time edge highlighting (blue on selection)
- Node type badge indicators (130x28px)
- Minimap and zoom controls
- Keyboard shortcuts (Delete, Esc)

### 2. Node Types
- **Context Nodes**: document, chat, pin (provide data)
- **Reasoning Nodes**: persona, model (process data)
- **Control Nodes**: start, end (workflow boundaries)

All nodes standardized to 280x88px with consistent styling.

### 3. Connection Rules (Guard Rails)
- Context → Reasoning ✅
- Context → Context ✅
- Reasoning → Reasoning ✅
- **Reasoning → Context ❌** (blocked for data flow integrity)

### 4. Execution System
- **Directed Acyclic Graph (DAG)** validation
- **Topological sort** for dependency resolution (Kahn's algorithm)
- Sequential node execution with status tracking
- Cycle detection prevents infinite loops
- Error handling with partial execution results

### 5. Data Persistence
- **Auto-save** with debouncing (2s delay to reduce API calls)
- **Local storage** for offline support with fallback
- Backend API integration with proper serialization
- **History management** with undo/redo (50 steps max, pruned automatically)

### 6. Performance Optimizations
- Memoized components and callbacks (`useMemo`, `useCallback`)
- Debounced auto-save prevents excessive API calls
- Pruned history limits memory usage (50 max entries)
- Optimized re-renders with React.memo
- Fetch timeouts for API calls (30s/60s/120s)

## Backend Integration

### API Endpoints

```typescript
// Workflows CRUD
GET    /api/workflows              - List workflows (paginated, searchable)
GET    /api/workflows/:id          - Get single workflow
POST   /api/workflows              - Create new workflow
PATCH  /api/workflows/:id          - Update existing workflow
DELETE /api/workflows/:id          - Delete workflow

// Execution
POST   /api/workflows/:id/execute  - Execute workflow (60s timeout)
GET    /api/workflows/:id/executions - Get execution history

// Sharing
POST   /api/workflows/:id/share    - Generate share URL

// File uploads
POST   /api/files/upload            - Upload file for document node (120s timeout)
```

### Data Format

**Request (WorkflowDTO)**:
```json
{
  "name": "My Workflow",
  "description": "Optional description",
  "nodes": [
    {
      "id": "node_1",
      "type": "custom",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Start",
        "type": "start",
        "status": "idle",
        "description": "Starting point"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2"
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

**Response (ExecutionResult)**:
```json
{
  "workflowId": "wf_123",
  "executionId": "exec_456",
  "status": "success",
  "nodeResults": {
    "node_1": {
      "nodeId": "node_1",
      "status": "success",
      "output": { "data": "..." },
      "processingTime": 123,
      "timestamp": "2026-02-05T10:00:00Z"
    }
  },
  "startTime": "2026-02-05T10:00:00Z",
  "endTime": "2026-02-05T10:00:10Z",
  "totalDuration": 10000
}
```

### Serialization
Frontend-only props (e.g., `isHighlighted`, `onOpenInstructions`) are stripped during serialization to backend using `serializeWorkflow()`. Backend responses are reconstructed with `deserializeWorkflow()`.

## Scalability Considerations

### Frontend Performance
1. **Component Memoization** - Prevents unnecessary re-renders
2. **Debounced Auto-save** - Reduces API calls (2s delay)
3. **History Pruning** - Limits memory usage (50 max entries)
4. **Lazy Loading** - Load workflows on demand
5. **UseMemo for Node Types** - Prevents recreation on every render

### Backend Requirements
1. **Caching** - Cache workflow definitions in Redis/Memcached
2. **Queue System** - For async execution (RabbitMQ, Bull, SQS)
3. **Rate Limiting** - Prevent abuse (e.g., 100 requests/min per user)
4. **File Storage** - S3 or similar for document nodes (50MB limit)
5. **Database Indexing** - On workflowId, userId, timestamps, tags
6. **Horizontal Scaling** - Stateless API servers behind load balancer

### Latency Optimization
- **Optimistic UI Updates** - Update UI before backend confirms
- **Local Storage Fallback** - Work offline, sync when online
- **Compression** - Gzip/Brotli API responses
- **CDN** - For static assets
- **WebSockets** - For real-time execution updates (future enhancement)
- **Connection Pooling** - Reuse database connections
- **Pagination** - Limit workflow lists to 20-50 items per page

## Usage

### Creating a Workflow
```tsx
import WorkflowCanvas from '@/components/workflows/WorkflowCanvas';

function WorkflowPage() {
  return <WorkflowCanvas />;
}
```

### Serialization for Backend
```typescript
import { serializeWorkflow, deserializeWorkflow } from './types';
import workflowAPI from './workflow-api';

// Serialize for backend
const dto = serializeWorkflow(workflowName, nodes, edges, viewport);
await workflowAPI.create(dto);

// Deserialize from backend
const workflow = await workflowAPI.get('wf_123');
const { nodes, edges, viewport } = deserializeWorkflow(workflow);
```

### Validation
```typescript
import { validateWorkflow } from './workflow-utils';

const { valid, errors } = validateWorkflow(nodes, edges);
if (!valid) {
  console.error('Workflow validation failed:', errors);
}
```

### Topological Sort
```typescript
import { topologicalSort } from './workflow-utils';

const executionOrder = topologicalSort(nodes, edges);
if (!executionOrder) {
  console.error('Workflow contains a cycle!');
}
```

## File Structure
```
/components/workflows/
  ├── WorkflowCanvas.tsx           # Main canvas (956 lines)
  ├── CustomNode.tsx               # Node component (204 lines)
  ├── DocumentNodeInspector.tsx    # File upload UI (256 lines)
  ├── TopBar.tsx                   # Header controls (130 lines)
  ├── LeftSidebar.tsx              # Node palette
  ├── RightInspector.tsx           # Properties panel
  ├── ContextMenu.tsx              # Right-click menu
  ├── UtilitySection.tsx           # Canvas controls
  ├── Footer.tsx                   # Stats display
  ├── types.ts                     # Type definitions (184 lines)
  ├── workflow-utils.ts            # Utilities (190 lines)
  ├── workflow-api.ts              # API client (205 lines)
  └── README.md                    # This file
```

## Future Enhancements
- [ ] Real-time collaboration (WebSockets)
- [ ] Workflow versioning (Git-style)
- [ ] Template marketplace
- [ ] Advanced node types (loop, condition, parallel execution)
- [ ] Workflow analytics dashboard
- [ ] Export to code (Python, JavaScript)
- [ ] AI-assisted workflow suggestions
- [ ] Workflow testing framework
- [ ] Performance profiling tools
- [ ] Multi-language support

## Performance Metrics
- **Initial Load**: < 1s
- **Node Rendering**: < 50ms per node
- **Auto-save Debounce**: 2s
- **API Timeout**: 30s (60s for execution, 120s for uploads)
- **History Limit**: 50 steps
- **Max File Size**: 50MB per file
- **Target Frame Rate**: 60 FPS on canvas interactions

## Browser Support
- Chrome/Edge 90+ (Recommended)
- Firefox 88+
- Safari 14+
- Touchpad and mouse wheel supported

## Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.example.com  # Backend API base URL
```

## Keyboard Shortcuts
- **Delete**: Delete selected node/edge
- **Esc**: Deselect all, close modals
- **Ctrl/Cmd + Z**: Undo (coming soon)
- **Ctrl/Cmd + Shift + Z**: Redo (coming soon)

## Accessing the Workflow Builder
Navigate to `/workflows` in your browser to access the workflow builder.

## License
Proprietary - All rights reserved
