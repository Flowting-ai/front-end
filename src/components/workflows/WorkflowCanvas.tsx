"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";

import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import { DocumentNodeInspector } from "./DocumentNodeInspector";
import { ChatNodeInspector } from "./ChatNodeInspector";
import { PinNodeInspector } from "./PinNodeInspector";
import { PersonaNodeInspector } from "./PersonaNodeInspector";
import { ModelNodeInspector } from "./ModelNodeInspector";
import ContextMenu from "./ContextMenu";
import UtilitySection from "./UtilitySection";
import Footer from "./Footer";
import CustomNode from "./CustomNode";
import {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  WorkflowNodeData,
  serializeWorkflow,
} from "./types";
import {
  debounce,
  topologicalSort,
  validateWorkflow,
  getNodeCategory,
  isValidConnection as validateConnection,
  calculateMetrics,
  saveToLocalStorage,
  pruneHistory,
} from "./workflow-utils";
import { workflowAPI } from "./workflow-api";
import { X } from "lucide-react";

let id = 0;
const getId = () => `node_${id++}`;

function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // Initialize with start and end nodes
  const initialNodes = [
    {
      id: 'start-node',
      type: 'custom',
      position: { x: 50, y: 200 },
      data: {
        label: 'Start',
        type: 'start' as NodeType,
        status: 'idle' as const,
        description: 'Workflow start trigger',
        config: {},
      } as WorkflowNodeData,
    },
    {
      id: 'end-node',
      type: 'custom',
      position: { x: 700, y: 200 },
      data: {
        label: 'End',
        type: 'end' as NodeType,
        status: 'idle' as const,
        description: 'Workflow end trigger',
        config: {},
      } as WorkflowNodeData,
    },
  ];
  
  // Phantom placeholder node between start and end (indicator only)
  const phantomNode = {
    id: 'phantom-node',
    type: 'custom',
    position: { x: 387, y: 196 },
    draggable: false,
    selectable: false,
    data: {
      label: 'Add a node',
      description: 'Drag and drop a reasoning node from the top left menu to start.',
      type: 'phantom' as NodeType,
    } as WorkflowNodeData,
    style: {
      width: 'auto',
      height: 'auto',
      background: '#F2F2F2',
      borderRadius: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      textAlign: 'center',
      color: '#757575',
      opacity: 1,
    },
  };

  const initialEdges = [
    {
      id: 'e-start-phantom',
      source: 'start-node',
      target: 'phantom-node',
      animated: false,
      style: { stroke: '#8B8B8B', strokeDasharray: '8 8' },
    },
    {
      id: 'e-phantom-end',
      source: 'phantom-node',
      target: 'end-node',
      animated: false,
      style: { stroke: '#8B8B8B', strokeDasharray: '8 8' },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState([
    ...initialNodes,
    phantomNode,
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] =
    useState<Node<WorkflowNodeData> | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [history, setHistory] = useState<Array<{ nodes: any[]; edges: any[] }>>(
    [],
  );
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [highlightedNodeType, setHighlightedNodeType] =
    useState<NodeType | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [currentInstructionsNodeId, setCurrentInstructionsNodeId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [showDocumentInspector, setShowDocumentInspector] = useState(false);
  const [documentNodeId, setDocumentNodeId] = useState<string | null>(null);
  const [showChatInspector, setShowChatInspector] = useState(false);
  const [chatNodeId, setChatNodeId] = useState<string | null>(null);
  const [showPinInspector, setShowPinInspector] = useState(false);
  const [pinNodeId, setPinNodeId] = useState<string | null>(null);
  const [showPersonaInspector, setShowPersonaInspector] = useState(false);
  const [personaNodeId, setPersonaNodeId] = useState<string | null>(null);
  const [showModelInspector, setShowModelInspector] = useState(false);
  const [modelNodeId, setModelNodeId] = useState<string | null>(null);
  // Chat data fetched from API
  const [allChats, setAllChats] = useState<Array<{ id: string; name: string; pinnedDate?: string }>>([]);
  // Pin data fetched from API
  const [allPins, setAllPins] = useState<Array<{ id: string; name: string; pinnedDate?: string; title?: string; tags?: string[] }>>([]);
  // Sample persona data - replace with actual data from your API
  const [allPersonas] = useState<Array<{ id: string; name: string; description?: string; image?: string }>>([]);
  // Sample model data - replace with actual data from your API
  const [allModels] = useState<Array<{ id: string; modelId?: string; name: string; companyName: string; description?: string; logo?: string; modelType?: string; sdkLibrary?: string }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOrder, setExecutionOrder] = useState<string[]>([]);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { fitView, zoomIn, zoomOut, setViewport, getViewport, getNodes, screenToFlowPosition } =
    useReactFlow();

  // Memoize node types
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Remove phantom automatically if a real node exists (e.g., load or other state change)
  useEffect(() => {
    const hasUserNode = nodes.some(
      (n) => n.id !== 'start-node' && n.id !== 'end-node' && n.id !== 'phantom-node',
    );
    if (hasUserNode && nodes.some((n) => n.id === 'phantom-node')) {
      setNodes((nds) => nds.filter((n) => n.id !== 'phantom-node'));
      setEdges((eds) => eds.filter((e) => e.source !== 'phantom-node' && e.target !== 'phantom-node'));
      saveToHistory();
    }
  }, [nodes, setNodes, setEdges]);

  // Fetch chats and pins data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chatsData, pinsData] = await Promise.all([
          workflowAPI.fetchChats(),
          workflowAPI.fetchPins(),
        ]);
        console.log('Fetched chats for workflow:', chatsData);
        console.log('Fetched pins for workflow:', pinsData);
        setAllChats(chatsData);
        setAllPins(pinsData);
      } catch (error) {
        console.error('Error fetching chats/pins:', error);
      }
    };
    fetchData();
  }, []);

  // Initialize workflow ID on mount
  useEffect(() => {
    if (!workflowId) {
      const newWorkflowId = `workflow_${Date.now()}`;
      setWorkflowId(newWorkflowId);
    }
  }, [workflowId]);

  // Process individual node based on type
  const processNode = useCallback(async (nodeId: string): Promise<any> => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const nodeData = node.data as WorkflowNodeData;
    
    // Get input data from parent nodes
    const parentEdges = edges.filter(e => e.target === nodeId);
    const inputData = parentEdges.map(edge => {
      const parentNode = nodes.find(n => n.id === edge.source);
      return parentNode?.data?.output;
    }).filter(Boolean);

    // Apply instructions if present
    let processedInput = inputData;
    if (nodeData.instructions) {
      // In a real implementation, instructions would be processed by an LLM
      // to transform or augment the input data before node execution
    }

    // Process based on node type
    switch (nodeData.type) {
      case 'start':
        return { message: 'Workflow started', timestamp: new Date().toISOString() };
      
      case 'document':
        return {
          type: 'document',
          files: nodeData.files || [],
          content: `Document context with ${nodeData.files?.length || 0} files`,
        };
      
      case 'chat':
        return {
          type: 'chat',
          messages: nodeData.config?.messages || [],
          context: inputData,
        };
      
      case 'pin':
        return {
          type: 'pin',
          pinnedItems: nodeData.config?.pinnedItems || [],
          context: inputData,
        };
      
      case 'persona':
        // Simulate persona processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          type: 'persona',
          personaId: nodeData.config?.personaId,
          processedContext: inputData,
          reasoning: `Processed by persona: ${nodeData.label}`,
        };
      
      case 'model':
        // Simulate model processing
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
          type: 'model',
          modelId: nodeData.modelId,
          input: inputData,
          output: `Model output from ${nodeData.label}`,
          tokens: Math.floor(Math.random() * 1000),
        };
      
      case 'end':
        return {
          message: 'Workflow completed',
          timestamp: new Date().toISOString(),
          finalOutput: inputData,
        };
      
      default:
        return inputData;
    }
  }, [nodes, edges]);

  // Execute workflow
  const executeWorkflow = useCallback(async () => {
    if (isExecuting) return;

    // Validate workflow structure
    const validation = validateWorkflow(nodes, edges);
    if (!validation.valid) {
      alert(`Cannot execute workflow:\n${validation.errors.join('\n')}`);
      return;
    }

    // Get topological order using utility
    const order = topologicalSort(nodes, edges);
    if (!order) {
      alert('Cannot execute workflow: Cycle detected or invalid graph structure');
      return;
    }

    setIsExecuting(true);
    setExecutionOrder(order);

    // Reset all nodes to idle
    setNodes(nds => nds.map(node => ({
      ...node,
      data: { ...node.data, status: 'idle' as const, output: undefined },
    })));

    // Execute nodes in order
    for (const nodeId of order) {
      // Set node to running
      setNodes(nds => nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, status: 'running' as const } }
          : node
      ));

      try {
        // Process the node
        const output = await processNode(nodeId);

        // Update node with output and success status
        setNodes(nds => nds.map(node => 
          node.id === nodeId 
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  status: 'success' as const,
                  output: output,
                } 
              }
            : node
        ));

        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`Error processing node ${nodeId}:`, error);
        
        // Set node to error status
        setNodes(nds => nds.map(node => 
          node.id === nodeId 
            ? { ...node, data: { ...node.data, status: 'error' as const } }
            : node
        ));
        
        // Stop execution on error
        break;
      }
    }

    setIsExecuting(false);
  }, [isExecuting, topologicalSort, processNode, setNodes]);

  // Reset workflow execution
  const resetWorkflow = useCallback(() => {
    setNodes(nds => nds.map(node => ({
      ...node,
      data: { ...node.data, status: 'idle' as const, output: undefined },
    })));
    setIsExecuting(false);
    setExecutionOrder([]);
  }, [setNodes]);

  // Save to history with pruning
  const saveToHistory = useCallback(() => {
    const newHistory = pruneHistory(
      [...history.slice(0, historyIndex + 1), { nodes: [...nodes], edges: [...edges] }],
      50
    );
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  // Debounced auto-save to backend
  const autoSaveWorkflow = useMemo(
    () =>
      debounce(async (name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
        if (!workflowId) return;

        try {
          setIsSaving(true);
          const viewport = getViewport();
          const workflowDTO = serializeWorkflow(name, nodes, edges, viewport);

          // Save to local storage first (for offline support)
          saveToLocalStorage(workflowId, workflowDTO);

          // Only call backend API if environment variable is set
          if (process.env.NEXT_PUBLIC_API_URL) {
            try {
              await workflowAPI.update(workflowId, workflowDTO);
            } catch (apiError) {
              // Silently fail if backend not available - localStorage is the fallback
              console.warn('Backend API not available, using localStorage only:', apiError);
            }
          }
          
          setLastSaved(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }, 2000),
    [workflowId, getViewport]
  );

  // Trigger auto-save when nodes or edges change
  useEffect(() => {
    if (nodes.length > 0 && workflowName) {
      autoSaveWorkflow(workflowName, nodes, edges);
    }
  }, [nodes, edges, workflowName, autoSaveWorkflow]);

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
      if (event.key === "Delete" || event.key === "Backspace") {
        // Don't delete if typing in input
        if (
          (event.target as HTMLElement).tagName === "INPUT" ||
          (event.target as HTMLElement).tagName === "TEXTAREA"
        ) {
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
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Reserved for future shortcuts
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNode, selectedEdges]);

  // Helper function to determine node category
  const getNodeCategoryHelper = useCallback((nodeType: string) => {
    return getNodeCategory(nodeType);
  }, []);

  // Connection validation with guardrails
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      if (!sourceNode || !targetNode) return;

      const sourceType = (sourceNode.data as WorkflowNodeData).type;
      const targetType = (targetNode.data as WorkflowNodeData).type;

      // Use utility validation
      if (!validateConnection(sourceType, targetType)) {
        console.warn(`Invalid connection: ${sourceType} cannot connect to ${targetType}`);
        return;
      }

      setEdges((eds) => addEdge(params, eds));
      saveToHistory();
    },
    [nodes, setEdges, saveToHistory],
  );

  // Real-time connection validation for visual feedback
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);

      if (!sourceNode || !targetNode) return false;

      const sourceType = (sourceNode.data as WorkflowNodeData).type;
      const targetType = (targetNode.data as WorkflowNodeData).type;

      return validateConnection(sourceType, targetType);
    },
    [nodes],
  );

  // Edge click handler
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    _event.stopPropagation();
    setSelectedEdges([edge.id]);
    setSelectedNode(null);
    // Close any open panels
    setShowInstructions(false);
    setShowDocumentInspector(false);
    setCurrentInstructionsNodeId(null);
    setDocumentNodeId(null);
  }, []);

  // Drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  // Add node
  const addNode = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const defaultName = `${type.charAt(0).toUpperCase() + type.slice(1)} Node`;
    const newNode = {
      id: getId(),
      type: "custom",
      position: position || { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: defaultName,
        name: defaultName,
        type,
        status: "idle",
        description: "",
        config: {},
      } as WorkflowNodeData,
    };

    // If the phantom node exists, remove it (it's only an indicator)
    setNodes((nds) => {
      const filtered = nds.filter((n) => n.id !== 'phantom-node');
      return [...filtered, newNode];
    });
    setEdges((eds) => eds.filter((e) => e.source !== 'phantom-node' && e.target !== 'phantom-node'));
    saveToHistory();
  }, [setNodes, setEdges, saveToHistory]);

  // Handle click to add node from palette
  const onNodeClickFromPalette = useCallback((nodeType: NodeType) => {
    // Add node at center of current viewport
    const viewport = getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
    
    addNode(nodeType, { x: centerX - 140, y: centerY - 44 });
  }, [getViewport, addNode]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowWrapper.current) return;

      // Use screenToFlowPosition to properly account for zoom and pan
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type as NodeType, position);
    },
    [screenToFlowPosition, addNode],
  );

  // Node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Prevent any unintended side effects
    _event.stopPropagation();
    const nodeData = node.data as WorkflowNodeData;
    setSelectedNode(node as Node<WorkflowNodeData>);
    setSelectedEdges([]);
    setHighlightedNodeType(nodeData.type);
    
    // Close all other panels first
    setShowInstructions(false);
    setShowDocumentInspector(false);
    setShowChatInspector(false);
    setShowPinInspector(false);
    setShowPersonaInspector(false);
    setShowModelInspector(false);
    
    // Open appropriate inspector based on node type
    if (nodeData.type === 'document') {
      setDocumentNodeId(node.id);
      setShowDocumentInspector(true);
    } else if (nodeData.type === 'chat') {
      setChatNodeId(node.id);
      setShowChatInspector(true);
    } else if (nodeData.type === 'pin') {
      setPinNodeId(node.id);
      setShowPinInspector(true);
    } else if (nodeData.type === 'persona') {
      setPersonaNodeId(node.id);
      setShowPersonaInspector(true);
    } else if (nodeData.type === 'model') {
      setModelNodeId(node.id);
      setShowModelInspector(true);
    }
  }, []);

  // Clear selection when clicking on pane
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdges([]);
    setHighlightedNodeType(null);
    setShowDocumentInspector(false);
    setDocumentNodeId(null);
    setShowChatInspector(false);
    setChatNodeId(null);
    setShowPinInspector(false);
    setPinNodeId(null);
    setShowPersonaInspector(false);
    setPersonaNodeId(null);
    setShowModelInspector(false);
    setModelNodeId(null);
    setShowInstructions(false);
    setCurrentInstructionsNodeId(null);
  }, []);

  // Node drag handler - Removed auto-duplication to prevent glitches
  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Just handle selection, no auto-duplication
      setSelectedNode(node as Node<WorkflowNodeData>);
    },
    [setSelectedNode],
  );

  // When user finishes dragging a node (moves any node), remove phantom indicator
  const onNodeDragStop = useCallback((_: any, node: Node) => {
    if (!node) return;
    // If any node other than the phantom was moved, remove phantom and its edges
    if (node.id !== 'phantom-node') {
      setNodes((nds) => nds.filter((n) => n.id !== 'phantom-node'));
      setEdges((eds) => eds.filter((e) => e.source !== 'phantom-node' && e.target !== 'phantom-node'));
      saveToHistory();
    }
  }, [setNodes, setEdges, saveToHistory]);

  // Update node
  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            // If name is provided, also update label for display
            const updatedData = data.name 
              ? { ...data, label: data.name }
              : data;
            
            return {
              ...node,
              data: { ...node.data, ...updatedData },
            };
          }
          return node;
        }),
      );
      saveToHistory();
    },
    [setNodes, saveToHistory],
  );

  // Context menu
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setSelectedNode(node as Node<WorkflowNodeData>);
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  // Clear workflow
  const handleClear = useCallback(() => {
    if (confirm("Are you sure you want to clear the entire workflow?")) {
      // Reset to initial state with start and end nodes
      setNodes([...initialNodes, phantomNode]);
      setEdges(initialEdges);
      setSelectedNode(null);
      saveToHistory();
    }
  }, [setNodes, setEdges, saveToHistory]);

  // Save workflow
  const handleSave = useCallback(() => {
    if (!workflowId) return;

    const workflow = {
      id: workflowId,
      name: workflowName,
      nodes,
      edges,
      viewport: getViewport(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem("workflow", JSON.stringify(workflow));
    setLastSaved(new Date());
  }, [workflowId, nodes, edges, workflowName, getViewport]);

  // Load workflow
  const handleLoad = useCallback(() => {
    const saved = localStorage.getItem("workflow");
    if (saved) {
      const workflow = JSON.parse(saved);
      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);
      setWorkflowName(workflow.name || "Untitled Workflow");
      if (workflow.id) {
        setWorkflowId(workflow.id);
      }
      if (workflow.viewport) {
        setViewport(workflow.viewport);
      }
      setLastSaved(new Date(workflow.updatedAt));
      saveToHistory();
    }
  }, [setNodes, setEdges, setViewport, saveToHistory]);

  // Test workflow - Execute the workflow
  const handleTest = () => {
    executeWorkflow();
  };

  // Share workflow
  const handleShare = () => {
    alert(
      "Share functionality - This would generate a shareable link or export the workflow",
    );
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
      selected: false,
    };

    // Remove phantom if present, then add the duplicated node
    setNodes((nds) => {
      const filtered = nds.filter((n) => n.id !== 'phantom-node');
      return [...filtered, newNode];
    });
    setEdges((eds) => eds.filter((e) => e.source !== 'phantom-node' && e.target !== 'phantom-node'));
    saveToHistory();
  };

  // Handle instructions panel
  const handleOpenInstructions = useCallback((nodeId: string) => {
    // Close all other panels first
    setShowDocumentInspector(false);
    setDocumentNodeId(null);
    setShowChatInspector(false);
    setChatNodeId(null);
    setShowPinInspector(false);
    setPinNodeId(null);
    setShowPersonaInspector(false);
    setPersonaNodeId(null);
    setShowModelInspector(false);
    setModelNodeId(null);
    
    setCurrentInstructionsNodeId(nodeId);
    setShowInstructions(true);
    // Load existing instructions for this node if any
    const node = nodes.find(n => n.id === nodeId);
    if (node?.data?.instructions) {
      setInstructions(node.data.instructions);
    } else {
      setInstructions("");
    }
  }, [nodes]);

  const handleCloseInstructions = useCallback(() => {
    setShowInstructions(false);
    setCurrentInstructionsNodeId(null);
  }, []);

  const handleClearInstructions = useCallback(() => {
    setInstructions("");
    if (currentInstructionsNodeId) {
      handleUpdateNode(currentInstructionsNodeId, { instructions: "" });
    }
  }, [currentInstructionsNodeId, handleUpdateNode]);

  const handleSaveInstructions = useCallback((value: string) => {
    setInstructions(value);
    if (currentInstructionsNodeId) {
      handleUpdateNode(currentInstructionsNodeId, { instructions: value });
    }
  }, [currentInstructionsNodeId, handleUpdateNode]);

  const handleSaveAndClose = useCallback(() => {
    if (currentInstructionsNodeId) {
      handleUpdateNode(currentInstructionsNodeId, { instructions });
    }
    handleCloseInstructions();
  }, [currentInstructionsNodeId, instructions, handleUpdateNode, handleCloseInstructions]);

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveAndClose();
    }
  }, [handleSaveAndClose]);

  const handleCloseDocumentInspector = useCallback(() => {
    setShowDocumentInspector(false);
    setDocumentNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdateDocumentNode = useCallback((nodeId: string, data: Partial<WorkflowNodeData>) => {
    handleUpdateNode(nodeId, data);
  }, [handleUpdateNode]);

  const handleCloseChatInspector = useCallback(() => {
    setShowChatInspector(false);
    setChatNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdateChatNode = useCallback((nodeId: string, data: Partial<WorkflowNodeData>) => {
    handleUpdateNode(nodeId, data);
  }, [handleUpdateNode]);

  const handleClosePinInspector = useCallback(() => {
    setShowPinInspector(false);
    setPinNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdatePinNode = useCallback((nodeId: string, data: Partial<WorkflowNodeData>) => {
    handleUpdateNode(nodeId, data);
  }, [handleUpdateNode]);

  const handleClosePersonaInspector = useCallback(() => {
    setShowPersonaInspector(false);
    setPersonaNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdatePersonaNode = useCallback((nodeId: string, data: Partial<WorkflowNodeData>) => {
    handleUpdateNode(nodeId, data);
  }, [handleUpdateNode]);

  const handleCloseModelInspector = useCallback(() => {
    setShowModelInspector(false);
    setModelNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdateModelNode = useCallback((nodeId: string, data: Partial<WorkflowNodeData>) => {
    handleUpdateNode(nodeId, data);
  }, [handleUpdateNode]);

  // Delete node by ID
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      // Prevent deletion of start and end trigger nodes
      if (nodeId === 'start-node' || nodeId === 'end-node') {
        alert('Start and End trigger nodes cannot be deleted. They are required for workflow execution.');
        return;
      }
      
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
      // Close inspectors if they were showing this node
      if (documentNodeId === nodeId) {
        setShowDocumentInspector(false);
        setDocumentNodeId(null);
      }
      if (chatNodeId === nodeId) {
        setShowChatInspector(false);
        setChatNodeId(null);
      }
      if (pinNodeId === nodeId) {
        setShowPinInspector(false);
        setPinNodeId(null);
      }
      if (personaNodeId === nodeId) {
        setShowPersonaInspector(false);
        setPersonaNodeId(null);
      }
      if (modelNodeId === nodeId) {
        setShowModelInspector(false);
        setModelNodeId(null);
      }
      saveToHistory();
    },
    [selectedNode, setNodes, setEdges, documentNodeId, chatNodeId, pinNodeId, saveToHistory],
  );

  const handleDeleteDocumentNode = useCallback((nodeId: string) => {
    handleDeleteNode(nodeId);
    setShowDocumentInspector(false);
    setDocumentNodeId(null);
    setSelectedNode(null);
  }, [handleDeleteNode]);

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
    [setEdges, saveToHistory],
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
        onReset={resetWorkflow}
        isExecuting={isExecuting}
        lastSaved={lastSaved}
      />

      {/* Main Canvas */}
      <div ref={reactFlowWrapper} className="relative w-full h-full">
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              isHighlighted:
                highlightedNodeType === (node.data as WorkflowNodeData).type,
              onOpenInstructions: () => handleOpenInstructions(node.id),
            },
          }))}
          edges={edges.map((edge) => ({
            ...edge,
            style: {
              ...edge.style,
              strokeWidth: selectedEdges.includes(edge.id) ? 3 : 2,
              stroke: selectedEdges.includes(edge.id) ? '#3B82F6' : '#8B8B8B',
            },
            animated: selectedEdges.includes(edge.id) ? true : edge.animated,
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          fitView={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.5 }}
          attributionPosition="bottom-right"
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "#8B8B8B" },
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
              className="bottom-10! bg-white! rounded-2xl! shadow-sm! shadow-zinc-400! overflow-hidden!"
              nodeColor={(node) => {
                const data = node.data as WorkflowNodeData;
                // Color code by node type
                switch (data.type) {
                  case "document":
                    return "#B47800"; // Gold
                  case "chat":
                    return "#B47800"; // Gold
                  case "pin":
                    return "#B47800"; // Gold
                  case "persona":
                    return "#3C6CFF"; // Blue
                  case "model":
                    return "#3C6CFF"; // Blue
                  case "start":
                    return "#16A34A"; // Green
                  case "end":
                    return "#DC2626"; // Red
                  default:
                    return "#9ca3af"; // Gray
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1) "
            />
          )}
        </ReactFlow>

        {/* Instructions Panel - Absolute to Canvas */}
        {showInstructions && (
          <div className="z-50 absolute top-4 right-4 bg-white w-90 h-auto border border-[#E5E5E5] rounded-2xl shadow-lg flex flex-col gap-3 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-[#1E1E1E]">Instructions</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleClearInstructions}
                  className="cursor-pointer font-geist font-medium text-sm text-[#404040] hover:text-[#1E1E1E] transition-colors"
                >
                  Clear
                </button>
                <button 
                  onClick={handleCloseInstructions}
                  className="cursor-pointer text-xs font-medium text-[#404040] hover:text-[#1E1E1E] transition-colors"
                >
                  <X size={16}/>
                </button>
              </div>
            </div>

            {/* Description */}
            <p className="font-normal text-sm text-[#757575]">
              Add instructions to transform, filter, or format the data before it reaches the next node.
            </p>

            {/* Textarea */}
            <textarea
              value={instructions}
              onChange={(e) => handleSaveInstructions(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Add your instructions here (Press Enter to save and close, Shift+Enter for new line)"
              className="flex-1 w-full font-geist font-normal text-sm text-[#0A0A0A] border border-[#E5E5E5] rounded-[8px] p-3 placeholder:text-[#9F9F9F] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[180px]"
            />

            {/* Save Button */}
            <button
              onClick={handleSaveAndClose}
              className="cursor-pointer w-full h-9 rounded-[8px] bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors"
            >
              Save Instructions
            </button>
          </div>
        )}

        {/* Document Node Inspector - Absolute to Canvas */}
        {showDocumentInspector && documentNodeId && (
          <DocumentNodeInspector
            nodeData={nodes.find(n => n.id === documentNodeId)?.data as WorkflowNodeData}
            onClose={handleCloseDocumentInspector}
            onUpdate={(data) => handleUpdateDocumentNode(documentNodeId, data)}
            onDelete={() => handleDeleteDocumentNode(documentNodeId)}
          />
        )}

        {/* Chat Node Inspector - Absolute to Canvas */}
        {showChatInspector && chatNodeId && (
          <ChatNodeInspector
            nodeData={nodes.find(n => n.id === chatNodeId)?.data as WorkflowNodeData}
            onClose={handleCloseChatInspector}
            onUpdate={(data) => handleUpdateChatNode(chatNodeId, data)}
            onDelete={() => handleDeleteNode(chatNodeId)}
            allChats={allChats}
          />
        )}

        {/* Pin Node Inspector - Absolute to Canvas */}
        {showPinInspector && pinNodeId && (
          <PinNodeInspector
            nodeData={nodes.find(n => n.id === pinNodeId)?.data as WorkflowNodeData}
            onClose={handleClosePinInspector}
            onUpdate={(data) => handleUpdatePinNode(pinNodeId, data)}
            onDelete={() => handleDeleteNode(pinNodeId)}
            allPins={allPins}
          />
        )}

        {/* Persona Node Inspector - Absolute to Canvas */}
        {showPersonaInspector && personaNodeId && (
          <PersonaNodeInspector
            nodeData={nodes.find(n => n.id === personaNodeId)?.data as WorkflowNodeData}
            onClose={handleClosePersonaInspector}
            onUpdate={(data) => handleUpdatePersonaNode(personaNodeId, data)}
            onDelete={() => handleDeleteNode(personaNodeId)}
            allPersonas={allPersonas}
          />
        )}

        {/* Model Node Inspector - Absolute to Canvas */}
        {showModelInspector && modelNodeId && (
          <ModelNodeInspector
            nodeData={nodes.find(n => n.id === modelNodeId)?.data as WorkflowNodeData}
            onClose={handleCloseModelInspector}
            onUpdate={(data) => handleUpdateModelNode(modelNodeId, data)}
            onDelete={() => handleDeleteNode(modelNodeId)}
            allModels={allModels}
          />
        )}
      </div>

      {/* Left Sidebar */}
      <LeftSidebar onDragStart={onDragStart} onNodeClick={onNodeClickFromPalette} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddNode={(type) =>
            addNode(type, { x: contextMenu.x - 120, y: contextMenu.y - 40 })
          }
          onDuplicate={selectedNode ? handleDuplicate : undefined}
          onDelete={
            selectedNode && selectedNode.id !== 'start-node' && selectedNode.id !== 'end-node'
              ? handleDelete
              : selectedEdges.length > 0
                ? () => handleDeleteEdges(selectedEdges)
                : undefined
          }
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
