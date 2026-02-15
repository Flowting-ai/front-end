# Node Counter System - Usage Examples

## Example 1: Fresh Workflow
```
Action                  | Result
------------------------|------------------
Add Model node         | "Model"
Add Model node         | "Model (1)"
Add Model node         | "Model (2)"
Add Persona node       | "Persona"
Add Persona node       | "Persona (1)"
Add Model node         | "Model (3)"
```

## Example 2: After Deletion
```
Initial State:
- Model
- Model (1)
- Model (2)

Delete "Model (1)"

Current State:
- Model
- Model (2)

Add Model node → "Model (3)"  ✓ (continues from max)
```

## Example 3: Duplicating Nodes
```
Initial State:
- Model

Duplicate "Model" → "Model (1)"

Current State:
- Model
- Model (1)

Duplicate "Model" again → "Model (2)"
Duplicate "Model (1)" → "Model (3)"
```

## Example 4: Loading Saved Workflow
```
Saved workflow contains:
- Model
- Model (3)
- Model (7)
- Persona
- Persona (2)

After loading, add Model → "Model (8)"
After loading, add Persona → "Persona (3)"
```

## Example 5: Independent Counters by Type
```
Action                  | Result
------------------------|------------------
Add Chat node          | "Chat"
Add Pin node           | "Pin"
Add Chat node          | "Chat (1)"
Add Model node         | "Model"
Add Pin node           | "Pin (1)"
Add Chat node          | "Chat (2)"
Add Model node         | "Model (1)"
```

Each node type maintains its own independent counter!

## Key Features
✅ First node has no counter
✅ Subsequent nodes get sequential numbers
✅ Counter persists after deletions
✅ Works with node duplication
✅ Each node type has independent numbering
✅ Compatible with saved/loaded workflows
