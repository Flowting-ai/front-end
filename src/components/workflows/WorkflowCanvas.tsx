'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import TopBar from './TopBar';
import LeftSidebar from './LeftSidebar';
import RightInspector from './RightInspector';
import ContextMenu from './ContextMenu';
import UtilitySection from './UtilitySection';
import Footer from './Footer';
import CustomNode from './CustomNode';
import { WorkflowNode, WorkflowEdge, NodeType, WorkflowNodeData } from './types';

const nodeTypes = {
  custom: CustomNode,
};

let id = 0;
const getId = () => `node_${id++}`;

function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [history, setHistory] = useState<Array<{ nodes: any[]; edges: any[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isDraggingWithAlt, setIsDraggingWithAlt] = useState(false);
  const [highlightedNodeType, setHighlightedNodeType] = useState<NodeType | null>(null);

  const { fitView, zoomIn, zoomOut, setViewport, getViewport, getNodes } = useReactFlow();

  // Save to history
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (nodes.length > 0 || edges.length > 0) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [nodes, edges]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Delete/Backspace - delete selected nodes/edges
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Don't delete if typing in input
        if ((event.target as HTMLElement).tagName === 'INPUT' || 
            (event.target as HTMLElement).tagName === 'TEXTAREA') {
          return;
        }
        event.preventDefault();
        
        // Delete selected node
        if (selectedNode) {
          handleDeleteNode(selectedNode.id);
        }
        
        // Delete selected edges
        if (selectedEdges.length > 0) {
          handleDeleteEdges(selectedEdges);
        }
      }

      // Alt key for duplication
      if (event.altKey) {
        setIsDraggingWithAlt(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.altKey) {
        setIsDraggingWithAlt(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNode, selectedEdges]);

  // Connection validation
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      saveToHistory();
    },
    [setEdges, saveToHistory]
  );

  // Edge click handler
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdges([edge.id]);
      setSelectedNode(null);
    },
    []
  );

  // Drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 120,
        y: event.clientY - reactFlowBounds.top - 40,
      };

      addNode(type as NodeType, position);
    },
    [nodes, setNodes, saveToHistory]
  );

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Add node
  const addNode = (type: NodeType, position?: { x: number; y: number }) => {
    const newNode = {
      id: getId(),
      type: 'custom',
      position: position || { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        type,
        status: 'idle',
        description: '',
        config: {},
      } as WorkflowNodeData,
    };

    setNodes((nds) => [...nds, newNode]);
    saveToHistory();
  };

  // Node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as WorkflowNodeData;
      setSelectedNode(node as Node<WorkflowNodeData>);
      setSelectedEdges([]);
      setHighlightedNodeType(nodeData.type);
    },
    []
  );

  // Clear selection when clicking on pane
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdges([]);
    setHighlightedNodeType(null);
  }, []);

  // Node drag with Alt for duplication
  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.altKey || isDraggingWithAlt) {
        const duplicatedNode = {
          ...node,
          id: getId(),
          position: {
            x: node.position.x + 50,
            y: node.position.y + 50,
          },
          selected: false,
        };
        setNodes((nds) => [...nds, duplicatedNode]);
        saveToHistory();
      }
    },
    [isDraggingWithAlt, setNodes, saveToHistory]
  );

  // Update node
  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...data },
            };
          }
          return node;
        })
      );
      saveToHistory();
    },
    [setNodes, saveToHistory]
  );

  // Context menu
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNode(node as Node<WorkflowNodeData>);
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // Clear workflow
  const handleClear = useCallback(() => {
    if (confirm('Are you sure you want to clear the entire workflow?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      saveToHistory();
    }
  }, [setNodes, setEdges, saveToHistory]);

  // Save workflow
  const handleSave = useCallback(() => {
    const workflow = {
      id: `workflow_${Date.now()}`,
      name: workflowName,
      nodes,
      edges,
      viewport: getViewport(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('workflow', JSON.stringify(workflow));
    setLastSaved(new Date());
  }, [nodes, edges, workflowName, getViewport]);

  // Load workflow
  const handleLoad = useCallback(() => {
    const saved = localStorage.getItem('workflow');
    if (saved) {
      const workflow = JSON.parse(saved);
      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);
      setWorkflowName(workflow.name || 'Untitled Workflow');
      if (workflow.viewport) {
        setViewport(workflow.viewport);
      }
      setLastSaved(new Date(workflow.updatedAt));
      saveToHistory();
    }
  }, [setNodes, setEdges, setViewport, saveToHistory]);

  // Test workflow
  const handleTest = () => {
    alert('Testing workflow functionality - This would execute the workflow in a real implementation');
  };

  // Share workflow
  const handleShare = () => {
    alert('Share functionality - This would generate a shareable link or export the workflow');
  };

  // Duplicate node
  const handleDuplicate = () => {
    if (!selectedNode) return;
    
    const newNode = {
      ...selectedNode,
      id: getId(),
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50,
      },
    };
    
    setNodes((nds) => [...nds, newNode]);
    saveToHistory();
  };

  // Delete node by ID
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
      saveToHistory();
    },
    [selectedNode, setNodes, setEdges, saveToHistory]
  );

  // Delete node (wrapper for context menu)
  const handleDelete = () => {
    if (!selectedNode) return;
    handleDeleteNode(selectedNode.id);
  };

  // Delete edges
  const handleDeleteEdges = useCallback(
    (edgeIds: string[]) => {
      setEdges((eds) => eds.filter((e) => !edgeIds.includes(e.id)));
      setSelectedEdges([]);
      saveToHistory();
    },
    [setEdges, saveToHistory]
  );

  // Delete from inspector
  const handleDeleteFromInspector = () => {
    if (selectedNode) {
      handleDeleteNode(selectedNode.id);
    }
  };

  return (
    <div className="w-full h-screen relative bg-[#F2F2F2]">
      {/* Top Bar */}
      <TopBar
        workflowName={workflowName}
        onNameChange={setWorkflowName}
        onTest={handleTest}
        onShare={handleShare}
        lastSaved={lastSaved}
      />

      {/* Main Canvas */}
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isHighlighted: highlightedNodeType === (node.data as WorkflowNodeData).type,
            },
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          fitView
          attributionPosition="bottom-right"
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: '#8B8B8B' },
            animated: true,
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={25}
            size={4}
            color="#E4E4E4"
          />
          {showMinimap && nodes.length > 0 && (
            <MiniMap
              className="!bg-white !border !border-gray-300 !rounded-lg"
              nodeColor={(node) => {
                const data = node.data as WorkflowNodeData;
                // Color code by node type
                switch (data.type) {
                  case 'document': return '#B47800'; // Gold
                  case 'chat': return '#B47800'; // Gold
                  case 'pin': return '#B47800'; // Gold
                  case 'persona': return '#3C6CFF'; // Blue
                  case 'model': return '#3C6CFF'; // Blue
                  default: return '#9ca3af'; // Gray
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              style={{ width: 200, height: 150 }}
            />
          )}
        </ReactFlow>
      </div>

      {/* Left Sidebar */}
      <LeftSidebar onDragStart={onDragStart} />

      {/* Right Inspector */}
      {selectedNode && (
        <RightInspector
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdateNode={handleUpdateNode}
          onDelete={handleDeleteFromInspector}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddNode={(type) => addNode(type, { x: contextMenu.x - 120, y: contextMenu.y - 40 })}
          onDuplicate={selectedNode ? handleDuplicate : undefined}
          onDelete={selectedNode ? handleDelete : selectedEdges.length > 0 ? () => handleDeleteEdges(selectedEdges) : undefined}
          selectedNodeId={selectedNode?.id}
          selectedEdgeIds={selectedEdges}
        />
      )}

      {/* Utility Section */}
      <UtilitySection
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFitView={() => fitView({ duration: 300 })}
        onClear={handleClear}
        onSave={handleSave}
        onLoad={handleLoad}
        onZoomIn={() => zoomIn({ duration: 300 })}
        onZoomOut={() => zoomOut({ duration: 300 })}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        showMinimap={showMinimap}
      />

      {/* Footer */}
      <Footer nodeCount={nodes.length} connectionCount={edges.length} />
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
