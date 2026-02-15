# Node Counter Implementation

## Overview
Implemented a dynamic counter system for workflow nodes to automatically number nodes of the same type.

## Behavior

### When Creating Nodes
- **First node of a type**: Named without counter (e.g., "Model", "Persona", "Chat")
- **Second node**: Named with (1) suffix (e.g., "Model (1)")
- **Third node**: Named with (2) suffix (e.g., "Model (2)")
- **And so on**: Counter increments continuously

### After Deletions
When a node is deleted, the counter **does not reset**. The next node created continues from the highest existing counter + 1.

**Example:**
1. Add Model → "Model"
2. Add Model → "Model (1)"
3. Add Model → "Model (2)"
4. Delete "Model (1)"
5. Add Model → "Model (3)" (not "Model (1)")

This prevents confusion and maintains a clear creation history.

## Implementation Details

### Modified Functions

#### 1. `addNode()` function
- Scans all existing nodes of the same type
- Extracts counter numbers using regex pattern `\((\d+)\)$`
- Finds the maximum counter value
- Assigns the next available counter

#### 2. `handleDuplicate()` function
- Applies the same counter logic when duplicating nodes
- Ensures duplicated nodes also get proper sequential numbering

### Pattern Used
The regex pattern `\((\d+)\)$` matches:
- "(1)", "(2)", "(10)", etc. at the end of node names
- Captures the numeric value for comparison

## Files Modified
- `WorkflowCanvas.tsx`: Updated `addNode()` and `handleDuplicate()` functions

## Testing Checklist
- [x] Add multiple nodes of the same type
- [x] Verify counter increments correctly
- [x] Delete a node and add a new one
- [x] Verify counter continues from max + 1
- [x] Duplicate a node and verify counter
- [x] Mix different node types and verify independent counters
