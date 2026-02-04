# Workflow Builder

A professional, production-level visual workflow builder with an infinite canvas, node-based system, and advanced features.

## Features

### Canvas & Layout
- **Infinite Canvas**: Pannable, zoomable canvas with smooth scrolling
- **Mouse & Touchpad Support**: 
  - Mouse wheel/trackpad zoom centered on cursor
  - Pinch zoom support
  - Dotted grid background with snap-to-grid
- **Virtual Origin**: Nodes can exist anywhere on the canvas

### Layout Zones

#### Left Sidebar (Node Palette)
- Fixed, collapsible panel with node categories
- **Context Nodes**:
  - Documents (file management)
  - Chats (conversation history)
  - Pins (saved content)
- **Reasoning Nodes**:
  - Agents/Persona (custom AI agents)
  - Models (AI model configuration)
- Drag-and-drop nodes onto canvas
- Hover effects with grip indicator

#### Main Canvas
- Infinite node graph editor
- Multi-select via Shift+click or drag selection
- Move, resize, copy, paste, duplicate nodes
- Right-click context menu
- Keyboard shortcuts

#### Right Inspector Panel
- Context-aware settings panel
- Changes based on selected node type
- Node configuration:
  - Editable name and description
  - File uploads (Document nodes)
  - Prompt controls (Model nodes)
  - Temperature and token settings
  - Real-time updates

#### Top Bar
- Back navigation
- Editable workflow title
- Auto-save indicator
- Test workflow button
- Share button

#### Utility Section (Bottom-Center)
- Undo/Redo functionality
- Zoom in/out controls
- Fit view
- Save workflow
- Load saved workflow
- Clear workflow

#### Footer
- Node count
- Connection count

## Node System

### Node Types

All nodes feature:
- Rounded rectangular cards
- Icon + type label
- Editable title
- Optional description
- Status badges (idle/running/success/error)
- Input/output ports for connections

### Ports & Connections

- Explicit input (left) and output (right) ports
- Curved Bézier connection lines
- Visual feedback:
  - Blue input ports
  - Green output ports
  - Animated data flow
- Drag to create connections
- Click to delete connections
- Compatible port highlighting

### Node Behaviors

#### Document Nodes
- File upload via drag & drop
- Multiple file attachment
- Context prompt configuration
- File list management

#### Model Nodes
- System prompt editor
- User prompt editor
- Temperature slider (0-2)
- Max tokens configuration
- Direct execution from canvas
- Output routing

#### Chat Nodes
- Conversation history display
- Context from upstream nodes
- Real-time message streaming

#### Persona Nodes
- Multi-model orchestration
- Tool integration
- Memory management
- Reasoning capabilities

#### Pin Nodes
- Store reusable content
- Quick reference data
- Cross-workflow sharing

## Interactions

### Canvas Interactions
- **Pan**: Click + drag on empty canvas
- **Zoom**: Mouse wheel or trackpad pinch
- **Select**: Click on node
- **Multi-select**: Shift + click or drag selection box
- **Context Menu**: Right-click on canvas or node

### Node Operations
- **Add**: Drag from palette or right-click menu
- **Edit**: Click to select, use inspector panel
- **Connect**: Drag from output port to input port
- **Duplicate**: Context menu or Ctrl+D
- **Delete**: Context menu or Delete key
- **Move**: Click and drag
- **Group**: Select multiple and use context menu

### Keyboard Shortcuts
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo
- **Ctrl/Cmd + D**: Duplicate
- **Delete**: Delete selected node
- **Ctrl/Cmd + S**: Save workflow
- **Shift + Click**: Multi-select

## Workflow Management

### Saving & Loading
- **Auto-save**: Every 30 seconds
- **Manual Save**: Click save button or Ctrl/Cmd + S
- **Load**: Restore saved workflows from localStorage
- **Export**: Share workflows (coming soon)

### History
- Undo/redo support
- Maintains state history
- Navigate through workflow changes

### Testing
- Test workflow execution
- Node-level status tracking
- Real-time feedback

## Visual Design

- Professional light mode interface
- Neutral, modern design system
- Rounded corners and subtle shadows
- Smooth hover states and transitions
- Clear focus states for accessibility
- Tailwind CSS v4 styling

## Technical Architecture

### Component Structure
```
/components/workflows/
  ├── WorkflowCanvas.tsx       # Main canvas component
  ├── TopBar.tsx              # Navigation and actions
  ├── LeftSidebar.tsx         # Node palette
  ├── RightInspector.tsx      # Settings panel
  ├── CustomNode.tsx          # Node component
  ├── ContextMenu.tsx         # Right-click menu
  ├── UtilitySection.tsx      # Bottom controls
  ├── Footer.tsx              # Stats footer
  ├── types.ts                # TypeScript definitions
  └── index.ts                # Exports
```

### State Management
- React hooks for local state
- ReactFlow for canvas state
- localStorage for persistence
- History tracking for undo/redo

### Extensibility
- Modular node definition system
- New node types can be registered
- Event-driven execution model
- Serializable graph structure

## Usage

### Creating a Workflow
1. Navigate to `/workflows`
2. Drag nodes from left sidebar onto canvas
3. Connect nodes by dragging from output to input ports
4. Configure nodes via right inspector panel
5. Test and save your workflow

### Adding Custom Nodes
Nodes are defined with:
- Type identifier
- UI components
- Configuration options
- Input/output port definitions
- Execution behavior

### Connecting Nodes
1. Click and drag from an output port (right side)
2. Drag to a compatible input port (left side)
3. Release to create connection
4. Connection validates port compatibility

### Executing Workflows
1. Configure all nodes with required settings
2. Click "Test Workflow" in top bar
3. Monitor node status changes
4. View results in inspector panel

## Browser Support

- Chrome/Edge (Recommended)
- Firefox
- Safari
- Touchpad and mouse wheel supported

## Future Enhancements

- [ ] Real workflow execution engine
- [ ] Cloud save/sync
- [ ] Collaboration features
- [ ] Custom node templates
- [ ] Workflow marketplace
- [ ] Advanced debugging tools
- [ ] Performance analytics
- [ ] Export/import formats (JSON, YAML)
- [ ] API integrations
- [ ] Version control

## Accessing the Workflow Builder

Navigate to `/workflows` in your browser to access the workflow builder.
