# Workflow Builder - Quick Start Guide

## Accessing the Workflow Builder

1. **From the Left Sidebar**: Click the "Workflow" button (with workflow icon)
2. **Direct URL**: Navigate to `/workflows` in your browser

## Getting Started

### 1. Create Your First Node

#### Option A: Drag and Drop
1. Look at the **Left Sidebar** (Node Palette)
2. Find a node type under **CONTEXT** or **REASONING**:
   - **Documents**: For file uploads and document context
   - **Chats**: For conversation history
   - **Pins**: For saved content
   - **Agents/Persona**: For custom AI agents
   - **Models**: For AI model configuration
3. **Click and drag** a node onto the canvas
4. Release to place it

#### Option B: Right-Click Menu
1. **Right-click** anywhere on the canvas
2. Select "Add Node" from the context menu
3. Choose your node type from the submenu

### 2. Configure Your Node

1. **Click** on a node to select it
2. The **Right Inspector Panel** opens automatically
3. Configure node settings:
   - **Name**: Edit the node title
   - **Description**: Add context about what this node does
   - **Type-specific settings**:
     - **Document nodes**: Upload files, add context prompts
     - **Model nodes**: Set system/user prompts, temperature, max tokens
     - **Chat nodes**: Configure conversation settings
     - **Persona nodes**: Set up agent behavior
     - **Pin nodes**: Add pinned content

### 3. Connect Nodes

1. **Hover** over the right side of a node to see the **output port** (green circle)
2. **Click and drag** from the output port
3. **Drag to** the left side of another node (blue input port)
4. **Release** to create the connection
5. The connection line will animate to show data flow

**Connection Rules**:
- Output ports are on the RIGHT (green)
- Input ports are on the LEFT (blue)
- Connections are directional (data flows left to right)
- Compatible ports will highlight when hovering

### 4. Canvas Navigation

**Zoom**:
- **Mouse Wheel**: Scroll up/down to zoom
- **Trackpad**: Pinch to zoom
- **Buttons**: Use + and - buttons in utility section

**Pan**:
- **Click and drag** on empty canvas space
- Canvas is infinite - nodes can go anywhere

**Fit View**:
- Click the **Maximize icon** in the utility section
- Automatically centers and scales to show all nodes

### 5. Save Your Workflow

**Auto-Save**:
- Automatically saves every 30 seconds
- Look for "Auto saved" indicator in top bar

**Manual Save**:
- Click **Save icon** in utility section
- Or use **Ctrl+S** (Cmd+S on Mac)

**Load Saved Workflow**:
- Click **Load icon** in utility section
- Restores your last saved workflow

### 6. Edit and Organize

**Select Nodes**:
- **Single select**: Click on a node
- **Multi-select**: Hold **Shift** and click multiple nodes
- **Box select**: Click and drag on empty canvas

**Move Nodes**:
- Click and drag a selected node
- Move multiple nodes together when multi-selected

**Duplicate Nodes**:
- Select a node
- Right-click → "Duplicate"
- Or use **Ctrl+D** (Cmd+D on Mac)

**Delete Nodes**:
- Select a node
- Right-click → "Delete"
- Or press **Delete** key

**Undo/Redo**:
- Click undo/redo icons in utility section
- Or use **Ctrl+Z** / **Ctrl+Shift+Z** (Cmd on Mac)

### 7. Test Your Workflow

1. Configure all nodes with required settings
2. Connect nodes in the desired flow
3. Click **"Test Workflow"** in the top bar
4. Monitor node status changes:
   - **Idle**: Node not yet executed
   - **Running**: Currently executing
   - **Success**: Completed successfully
   - **Error**: Failed with error

### 8. Share Your Workflow

1. Click the **"Share"** button in the top bar
2. Get a shareable link or export configuration
3. Share with team members or collaborators

## Tips and Tricks

### Node Organization
- Use descriptive names for nodes
- Add descriptions to document your workflow logic
- Group related nodes together visually
- Use the minimap (bottom-right) to navigate large workflows

### Performance
- The canvas handles hundreds of nodes smoothly
- Use the minimap to jump to different areas
- Fit view to reset your viewport

### Keyboard Shortcuts
- **Ctrl/Cmd + S**: Save workflow
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo
- **Ctrl/Cmd + D**: Duplicate selected node
- **Delete**: Delete selected node
- **Shift + Click**: Multi-select nodes

### Connection Management
- Click on a connection to select it
- Delete key removes selected connections
- Re-route connections by dragging endpoints
- Animated connections show active data flow

### Context Menu Options
**On Canvas**:
- Add Node
- Reset Position

**On Node**:
- Duplicate
- Delete
- Group (coming soon)
- Reset Position

## Common Workflows

### Example 1: Document Processing
1. Add **Document node** → Upload files
2. Add **Model node** → Configure prompt to analyze documents
3. **Connect** Document → Model
4. Test and review output

### Example 2: Multi-Model Comparison
1. Add **Pin node** → Add input prompt
2. Add multiple **Model nodes** → Configure different models
3. **Connect** Pin → Each Model node
4. Compare outputs in inspector panels

### Example 3: Agent Workflow
1. Add **Chat node** → Conversation context
2. Add **Persona node** → Configure agent behavior
3. Add **Model node** → Execution model
4. **Connect** Chat → Persona → Model
5. Test agent responses

## Troubleshooting

**Node not connecting?**
- Ensure you're dragging from output (right) to input (left)
- Check if ports are compatible (they'll highlight green)

**Can't find a node?**
- Check if you've scrolled away from your nodes
- Click "Fit View" to center all nodes

**Inspector not showing?**
- Click on a node to select it
- Only one node can be inspected at a time

**Workflow not saving?**
- Check "Auto saved" indicator in top bar
- Manually click save if needed
- Ensure browser has localStorage enabled

**Canvas too small/large?**
- Use zoom controls to adjust
- Click "Fit View" to auto-scale

## Need Help?

- Hover over any button to see tooltips
- Right-click for contextual options
- Check the README.md for technical details
- Node help text available in inspector panel

## Next Steps

1. Experiment with different node types
2. Create complex multi-node workflows
3. Save and organize your workflows
4. Share with your team
5. Build production AI systems visually!

---

**Enjoy building powerful AI workflows! 🚀**
