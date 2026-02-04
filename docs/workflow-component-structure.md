# Workflow Builder - Component Structure

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ TopBar (h-14, gradient bg)                                          │
│ ┌──────────┬───────────────────────────────┬──────────────────────┐│
│ │← Back    │ Workflow Title (editable)     │Auto│Test│Share       ││
│ └──────────┴───────────────────────────────┴──────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────┐                                      ┌─────────────┐│
│  │LeftSidebar │         Main Canvas                  │   Right     ││
│  │ (240px)    │      (Infinite scroll)               │ Inspector   ││
│  │            │                                       │  (320px)    ││
│  │ CONTEXT    │  ┌─────┐      ┌─────┐               │             ││
│  │ • Docs     │  │Node1│──────│Node2│               │ ┌─────────┐ ││
│  │ • Chats    │  └─────┘      └─────┘               │ │Settings │ ││
│  │ • Pins     │         │                            │ │         │ ││
│  │            │         │                            │ │  Name   │ ││
│  │ REASONING  │  ┌─────▼─────┐                      │ │  Desc   │ ││
│  │ • Persona  │  │   Node3   │                      │ │  Config │ ││
│  │ • Models   │  └───────────┘                      │ │         │ ││
│  │            │                                       │ │  [...]  │ ││
│  │            │                                       │ │         │ ││
│  └────────────┘                                       └─────────────┘│
│                                                                       │
│                      ┌─────────────────────────┐                    │
│                      │   Utility Section       │                    │
│                      │ [↶][↷][+][-][⊡][💾][📁][🗑] │                    │
│                      └─────────────────────────┘                    │
├─────────────────────────────────────────────────────────────────────┤
│ Footer (h-10)                                                        │
│ 5 nodes • 3 connections                              Workflow Builder│
└─────────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
WorkflowCanvas (Main Container)
├── TopBar
│   ├── Back Button (←)
│   ├── Workflow Title (editable)
│   └── Actions
│       ├── Auto-save Indicator
│       ├── Test Workflow Button
│       └── Share Button
│
├── ReactFlow (Canvas Area)
│   ├── Background (dots pattern)
│   ├── MiniMap
│   ├── Controls
│   └── Nodes (CustomNode instances)
│       ├── Node Header
│       │   ├── Icon
│       │   ├── Type Label
│       │   └── Status Badge
│       ├── Node Content
│       │   ├── Title
│       │   └── Description
│       └── Ports
│           ├── Input Handle (left)
│           └── Output Handle (right)
│
├── LeftSidebar
│   ├── CONTEXT Category
│   │   ├── Documents Node
│   │   ├── Chats Node
│   │   └── Pins Node
│   └── REASONING Category
│       ├── Agents/Persona Node
│       └── Models Node
│
├── RightInspector (conditional)
│   ├── Header (with close button)
│   ├── Node Settings
│   │   ├── Type Badge
│   │   ├── Status Badge
│   │   ├── Name Input
│   │   ├── Description Textarea
│   │   └── Type-Specific Controls
│   │       ├── Document: File Upload + List
│   │       ├── Model: Prompts + Sliders
│   │       ├── Chat: Config
│   │       ├── Persona: Config
│   │       └── Pin: Content
│   └── Help Section
│
├── ContextMenu (conditional)
│   ├── Add Node (submenu)
│   │   ├── Document
│   │   ├── Chat
│   │   ├── Pin
│   │   ├── Persona
│   │   └── Model
│   ├── Duplicate (if node selected)
│   ├── Delete (if node selected)
│   ├── Group (if node selected)
│   └── Reset Position (if node selected)
│
├── UtilitySection
│   ├── Undo Button
│   ├── Redo Button
│   ├── Zoom In Button
│   ├── Zoom Out Button
│   ├── Fit View Button
│   ├── Save Button
│   ├── Load Button
│   └── Clear Button
│
└── Footer
    ├── Left: Stats (nodes, connections)
    └── Right: Info
```

## Data Flow

```
User Interaction
      │
      ├─→ Drag Node from Palette → onDragStart → onDrop → addNode()
      │
      ├─→ Connect Nodes → onConnect → setEdges() → saveToHistory()
      │
      ├─→ Select Node → onNodeClick → setSelectedNode() → RightInspector opens
      │
      ├─→ Update Node → onUpdateNode → setNodes() → saveToHistory()
      │
      ├─→ Right-Click → onPaneContextMenu/onNodeContextMenu → ContextMenu
      │
      ├─→ Undo/Redo → handleUndo/handleRedo → restore from history
      │
      └─→ Save/Load → handleSave/handleLoad → localStorage
```

## State Management

```
WorkflowCanvas State
├── nodes: Node[]                    # All nodes on canvas
├── edges: Edge[]                    # All connections
├── selectedNode: Node | null        # Currently selected node
├── contextMenu: {x, y} | null      # Context menu position
├── workflowName: string            # Workflow title
├── lastSaved: Date | null          # Last save timestamp
├── history: Array<{nodes, edges}>  # Undo/redo history
├── historyIndex: number            # Current position in history
└── snapToGrid: boolean             # Snap-to-grid toggle
```

## File Organization

```
front-end/
├── src/
│   ├── app/
│   │   └── workflows/
│   │       └── page.tsx                    # Route entry point
│   │
│   └── components/
│       └── workflows/
│           ├── WorkflowCanvas.tsx          # Main component (ReactFlowProvider)
│           ├── TopBar.tsx                  # Top navigation bar
│           ├── LeftSidebar.tsx            # Node palette
│           ├── RightInspector.tsx         # Settings panel
│           ├── CustomNode.tsx             # Node component
│           ├── ContextMenu.tsx            # Right-click menu
│           ├── UtilitySection.tsx         # Bottom controls
│           ├── Footer.tsx                 # Stats footer
│           ├── types.ts                   # TypeScript definitions
│           ├── index.ts                   # Component exports
│           └── README.md                  # Technical docs
│
├── docs/
│   └── workflow-quick-start.md            # User guide
│
└── WORKFLOW_IMPLEMENTATION_SUMMARY.md      # Implementation summary
```

## Node Types & Icons

```
CONTEXT Category (Gray #757575)
├── 📄 Documents    (Lucide: Files)
├── 💬 Chats        (Lucide: MessagesSquare)
└── 📌 Pins         (Lucide: Pin)

REASONING Category (Gray #757575)
├── 👤 Agents       (Lucide: SquareUser)
└── 🧠 Models       (Lucide: BrainCircuit)
```

## Connection Types

```
Node Output Port (Right) ──────► Node Input Port (Left)
     (Green)                          (Blue)
        │                               │
        └───────── Bézier Curve ───────┘
                (Animated, Green)
```

## Interaction Patterns

### Drag & Drop
```
LeftSidebar → Drag Node → Canvas → Drop → Create Node
```

### Node Connection
```
Node A (Output) → Drag → Node B (Input) → Release → Create Edge
```

### Node Configuration
```
Select Node → Inspector Opens → Edit Settings → Auto-update → Save to History
```

### Context Menu
```
Right-Click → Menu Opens → Select Action → Execute → Menu Closes
```

### History Management
```
Action → saveToHistory() → Update History Array → Enable Undo/Redo
```

### Persistence
```
Auto-save Timer (30s) → handleSave() → localStorage → Update lastSaved
Manual Save → handleSave() → localStorage → Update lastSaved
Load → handleLoad() → localStorage → Restore State
```

## Event Handlers

```javascript
Canvas Events:
├── onNodesChange      # Node position/selection changes
├── onEdgesChange      # Edge changes
├── onConnect          # New connection created
├── onNodeClick        # Node selected
├── onPaneContextMenu  # Right-click on canvas
├── onNodeContextMenu  # Right-click on node
├── onDrop             # Node dropped from palette
└── onDragOver         # Drag over canvas

User Actions:
├── onDragStart        # Start dragging from palette
├── handleUndo         # Undo last action
├── handleRedo         # Redo last undone action
├── handleSave         # Save workflow
├── handleLoad         # Load workflow
├── handleClear        # Clear all nodes/edges
├── handleTest         # Test workflow
├── handleShare        # Share workflow
├── handleDuplicate    # Duplicate selected node
└── handleDelete       # Delete selected node
```

## Styling Strategy

### Tailwind Classes Used
- Layout: `flex`, `grid`, `absolute`, `relative`
- Sizing: `w-full`, `h-screen`, `w-60`, `h-14`
- Spacing: `p-4`, `px-2`, `py-1`, `gap-2`, `space-y-1`
- Colors: Custom hex values (`#E4E4E4`, `#757575`, `#00812F`)
- Borders: `border`, `border-2`, `rounded-xl`, `rounded-2xl`
- Typography: `font-inter`, `text-sm`, `font-semibold`
- Effects: `shadow-lg`, `hover:bg-gray-100`, `transition-all`
- Background: `bg-white`, `bg-gradient-to-b`

### Custom Styling
- Canvas background: `#E4E4E4`
- Grid dots: 20px gap, gray color
- Node borders: 2px, gray/blue (selected)
- Ports: 12px circles, blue (input), green (output)
- Connections: 2px width, green, animated

## Performance Optimizations

```
✓ Memoized CustomNode component
✓ UseCallback for event handlers
✓ Efficient state updates (functional setState)
✓ React Flow built-in optimizations
✓ Minimal re-renders
✓ Smooth 60fps interactions
```

---

This structure provides a complete, production-ready workflow builder system.
