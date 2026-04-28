"use client";

/**
 * useWorkflowState — centralises every piece of state, every ref, every effect,
 * and every callback that lives inside WorkflowCanvasInner.
 *
 * Prior to this extraction WorkflowCanvasInner was a ~2 000-line monolith that
 * mixed canvas data management, persistence, undo/redo, inspector/panel
 * visibility, external API data, keyboard shortcuts, and execution logic all in
 * the same render function.  This hook moves all of that work into a single,
 * well-organised module so the component can focus solely on JSX.
 *
 * ─── Architecture notes ───────────────────────────────────────────────────────
 *
 * The hook calls useReactFlow(), useNodesState(), useEdgesState() internally, so
 * it MUST be invoked from a component that is already mounted inside a
 * <ReactFlowProvider> (WorkflowCanvasInner is already wrapped by one in the
 * WorkflowCanvas default export).
 *
 * useSearchParams, useRouter, and useAuth are also called here so the component
 * has zero direct dependency on routing or auth context.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *  1. Module-level canvas constants (initial nodes / edges / phantom)
 *  2. Core ReactFlow / router / auth hooks
 *  3. Node & edge state + history
 *  4. Workflow metadata (name, id, save status, unsaved tracking)
 *  5. Canvas UI preferences (snap, minimap, highlight, context menu)
 *  6. Inspector / panel visibility state
 *  7. External API data (chats, pins, personas, models)
 *  8. Execution state
 *  9. Plan-limit & dialog state
 * 10. Refs
 * 11. Effects (data fetching, hydration, UI sync, keyboard shortcuts)
 * 12. History callbacks (saveToHistory, undo, redo)
 * 13. Edge / connection callbacks
 * 14. Drag & drop / node mutation callbacks
 * 15. Selection / pane callbacks
 * 16. Inspector open / close / update callbacks
 * 17. Persistence callbacks (save, load, test, run, back)
 * 18. Execution callbacks (handleRunStart, handleNodeStatusChange)
 * 19. Return value
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "reactflow";
import {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  NodeStatus,
  WorkflowNodeData,
  serializeWorkflow,
} from "@/components/workflows/types";
import {
  topologicalSort,
  validateWorkflow,
  getNodeCategory,
  isValidConnection as validateConnection,
  pruneHistory,
} from "@/components/workflows/workflow-utils";
import { workflowAPI } from "@/components/workflows/workflow-api";
import { toast } from "@/lib/toast-helper";
import { useAuth } from "@/context/auth-context";
import { hasReachedLimit } from "@/lib/plan-config";

// ─── 1. Module-level canvas constants ────────────────────────────────────────

const getId = () => crypto.randomUUID();

/** Start and end control nodes that are always present on a fresh canvas. */
export const INITIAL_NODES: WorkflowNode[] = [
  {
    id: "start-node",
    type: "custom",
    position: { x: 200, y: 350 },
    data: {
      label: "Start",
      type: "start" as NodeType,
      status: "idle",
      description: "Workflow start trigger",
      config: {},
    } as WorkflowNodeData,
  },
  {
    id: "end-node",
    type: "custom",
    position: { x: 950, y: 350 },
    data: {
      label: "End",
      type: "end" as NodeType,
      status: "idle",
      description: "Workflow end trigger",
      config: {},
    } as WorkflowNodeData,
  },
];

/**
 * Phantom placeholder shown between Start and End on an empty canvas.
 * It is automatically removed the moment a real user node is added.
 */
export const PHANTOM_NODE: WorkflowNode = {
  id: "phantom-node",
  type: "custom",
  position: { x: 587, y: 351.5 },
  draggable: false,
  selectable: false,
  data: {
    label: "Add a node",
    description: "Drag and drop a node from the top left menu to start.",
    type: "phantom" as NodeType,
  } as WorkflowNodeData,
  style: {
    width: "auto",
    height: "auto",
    background: "#F2F2F2",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    textAlign: "center",
    color: "#757575",
    opacity: 1,
  },
};

export const INITIAL_EDGES: WorkflowEdge[] = [
  {
    id: "e-start-phantom",
    source: "start-node",
    target: "phantom-node",
    animated: false,
    style: { stroke: "#8B8B8B", strokeDasharray: "8 8" },
  },
  {
    id: "e-phantom-end",
    source: "phantom-node",
    target: "end-node",
    animated: false,
    style: { stroke: "#8B8B8B", strokeDasharray: "8 8" },
  },
];

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface ChatRecord {
  id: string;
  name: string;
  pinnedDate?: string;
}

export interface PinRecord {
  id: string;
  name: string;
  pinnedDate?: string;
  title?: string;
  tags?: string[];
  folderId?: string;
  folderName?: string;
}

export interface PersonaRecord {
  id: string;
  name: string;
  description?: string;
  image?: string;
  modelId?: string;
  status?: "active" | "paused";
}

export interface ModelRecord {
  id: string;
  modelId?: string;
  name: string;
  companyName: string;
  description?: string;
  logo?: string;
  modelType?: "free" | "paid";
  sdkLibrary?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWorkflowState() {
  // ── 2. Core hooks ───────────────────────────────────────────────────────────

  const { fitView, zoomIn, zoomOut, setViewport, getViewport, screenToFlowPosition } =
    useReactFlow();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  // ── 3. Node / edge state + history ─────────────────────────────────────────

  const [nodes, setNodes, onNodesChange] = useNodesState([
    ...INITIAL_NODES,
    PHANTOM_NODE,
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] =
    useState<Node<WorkflowNodeData> | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [history, setHistory] = useState<Array<{ nodes: any[]; edges: any[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ── 4. Workflow metadata ────────────────────────────────────────────────────

  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  /** Raw File waiting to be uploaded on the next save. */
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // ── 5. Canvas UI preferences ────────────────────────────────────────────────

  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [highlightedNodeType, setHighlightedNodeType] =
    useState<NodeType | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(
    null,
  );

  // ── 6. Inspector / panel visibility ────────────────────────────────────────

  const [showInstructions, setShowInstructions] = useState(false);
  const [currentInstructionsNodeId, setCurrentInstructionsNodeId] =
    useState<string | null>(null);
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

  const [showEdgeDetails, setShowEdgeDetails] = useState(false);
  const [selectedEdgeForDetails, setSelectedEdgeForDetails] =
    useState<Edge | null>(null);

  const [showWorkflowChat, setShowWorkflowChat] = useState(false);

  // ── 7. External API data ────────────────────────────────────────────────────

  const [allChats, setAllChats] = useState<ChatRecord[]>([]);
  const [allPins, setAllPins] = useState<PinRecord[]>([]);
  const [allPersonas, setAllPersonas] = useState<PersonaRecord[]>([]);
  const [allModels, setAllModels] = useState<ModelRecord[]>([]);

  // ── 8. Execution state ──────────────────────────────────────────────────────

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOrder, setExecutionOrder] = useState<string[]>([]);

  // ── 9. Plan-limit & dialog state ───────────────────────────────────────────

  const [workflowCount, setWorkflowCount] = useState(0);
  const [showWorkflowUpgradeDialog, setShowWorkflowUpgradeDialog] =
    useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ── 10. Refs ────────────────────────────────────────────────────────────────

  /**
   * True during the very first render cycle — used to initialise the saved
   * snapshot baseline without immediately marking the workflow as dirty.
   */
  const isInitialMount = useRef(true);
  /**
   * Guards against the URL-based workflow load running more than once
   * (StrictMode / navigation events can otherwise trigger it twice).
   */
  const hasLoadedQueryWorkflow = useRef(false);
  /** Suppresses the unsaved-changes flag immediately after a successful save. */
  const hasJustSaved = useRef(false);
  /**
   * Structural JSON snapshot of the last persisted state. The unsaved-changes
   * detector compares the current snapshot against this reference.
   */
  const lastSavedSnapshotRef = useRef<string | null>(null);

  // ── 11. Effects ─────────────────────────────────────────────────────────────

  // Fetch workflow count for plan-limit enforcement.
  useEffect(() => {
    workflowAPI.list().then(({ total }) => setWorkflowCount(total)).catch(() => {});
  }, []);

  // Remove the phantom placeholder as soon as any real user node appears.
  // SAFETY: This effect only removes the phantom — never modifies real nodes.
  useEffect(() => {
    const hasUserNode = nodes.some(
      (n) =>
        n.id !== "start-node" && n.id !== "end-node" && n.id !== "phantom-node",
    );
    const hasPhantomNode = nodes.some((n) => n.id === "phantom-node");
    if (hasUserNode && hasPhantomNode) {
      setNodes((nds) => nds.filter((n) => n.id !== "phantom-node"));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== "phantom-node" && e.target !== "phantom-node",
        ),
      );
    }
  }, [nodes, setNodes, setEdges]);

  // Fetch chats, pins, personas, and models on mount for inspector dropdowns.
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chatsData, pinsData, personasData, modelsData] = await Promise.all([
          workflowAPI.fetchChats(),
          workflowAPI.fetchPins(),
          workflowAPI.fetchPersonas(),
          workflowAPI.fetchModels(),
        ]);
        setAllChats(chatsData);
        setAllPins(pinsData);
        setAllPersonas(personasData);
        setAllModels(modelsData);
      } catch (error) {
        console.error("[useWorkflowState] Error fetching workflow data:", error);
      }
    };
    void fetchData();
  }, []);

  // Hydrate model nodes with full display data once the models list has loaded.
  // Only enriches display metadata — does not affect the structural snapshot.
  useEffect(() => {
    if (!allModels.length) return;
    setNodes((nds) =>
      nds.map((node) => {
        const nodeData = node.data as WorkflowNodeData;
        if (nodeData.type !== "model") return node;
        const selectedModelId = (
          nodeData.selectedModel ||
          nodeData.modelId ||
          ""
        )
          .toString()
          .trim();
        if (!selectedModelId) return node;
        const model = allModels.find(
          (m) => m.id === selectedModelId || m.modelId === selectedModelId,
        );
        if (!model) return node;
        const existingModelData = nodeData.modelData || {};
        return {
          ...node,
          data: {
            ...nodeData,
            selectedModel: selectedModelId,
            modelId: selectedModelId,
            modelData: {
              ...existingModelData,
              name: model.name,
              description: model.description,
              companyName: model.companyName,
              sdkLibrary: model.sdkLibrary,
              logo: model.logo,
            },
          },
        };
      }),
    );
  }, [allModels, setNodes]);

  // Hydrate chat nodes with display data once the chats list has loaded.
  useEffect(() => {
    if (!allChats.length) return;
    setNodes((nds) =>
      nds.map((node) => {
        const nodeData = node.data as WorkflowNodeData;
        if (nodeData.type !== "chat") return node;
        const selectedChatId = (nodeData.selectedChats || "").toString().trim();
        if (!selectedChatId) return node;
        const chat = allChats.find((c) => c.id === selectedChatId);
        if (!chat) return node;
        return {
          ...node,
          data: {
            ...nodeData,
            chatData: { name: chat.name, id: chat.id, pinnedDate: chat.pinnedDate },
          },
        };
      }),
    );
  }, [allChats, setNodes]);

  // Hydrate persona nodes with display data once the personas list has loaded.
  useEffect(() => {
    if (!allPersonas.length) return;
    setNodes((nds) =>
      nds.map((node) => {
        const nodeData = node.data as WorkflowNodeData;
        if (nodeData.type !== "persona") return node;
        const selectedPersonaId = (nodeData.selectedPersona || "")
          .toString()
          .trim();
        if (!selectedPersonaId) return node;
        const persona = allPersonas.find((p) => p.id === selectedPersonaId);
        if (!persona) return node;
        return {
          ...node,
          data: {
            ...nodeData,
            personaData: {
              name: persona.name,
              image: persona.image,
              description: persona.description,
              modelId: persona.modelId,
            },
          },
        };
      }),
    );
  }, [allPersonas, setNodes]);

  // Hydrate pin folder nodes with folder-name and pin-id list from loaded pins.
  useEffect(() => {
    if (!allPins.length) return;
    setNodes((nds) =>
      nds.map((node) => {
        const nodeData = node.data as WorkflowNodeData;
        if (nodeData.type !== "pin") return node;
        if (!nodeData.selectedFolder?.id) return node;
        const folderId = nodeData.selectedFolder.id;
        const folderPins = allPins.filter((p) => p.folderId === folderId);
        const folderName =
          folderPins[0]?.folderName || nodeData.selectedFolder.name;
        const pinIds = folderPins.map((p) => p.id);
        return {
          ...node,
          data: {
            ...nodeData,
            selectedFolder: { id: folderId, name: folderName, pinIds },
          },
        };
      }),
    );
  }, [allPins, setNodes]);

  // Center the canvas on initial mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ duration: 300, padding: 0.7 });
    }, 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  // ── Unsaved-changes tracking ─────────────────────────────────────────────────

  /**
   * Builds a deterministic structural JSON snapshot of the workflow that
   * deliberately excludes runtime-only fields (status, output, model display
   * data, highlighting) so that those transient mutations never dirty the flag.
   * The thumbnail URL is appended with a separator so thumbnail edits are also
   * tracked.
   */
  const buildWorkflowSnapshot = useCallback(
    (
      snapshotName: string,
      snapshotNodes: WorkflowNode[],
      snapshotEdges: WorkflowEdge[],
    ): string => {
      const nodePayload = snapshotNodes.map((node) => {
        const data = node.data as WorkflowNodeData;
        return {
          id: node.id,
          position: node.position,
          type: data.type,
          label: data.label,
          name: data.name,
          description: data.description,
          config: data.config,
          files: data.files,
          prompt: data.prompt,
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          modelId: data.modelId,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          tools: data.tools,
          instructions: data.instructions,
          selectedChats: data.selectedChats,
          selectedPins: data.selectedPins,
          selectedFolderId: data.selectedFolder?.id,
          selectedPersona: data.selectedPersona,
          selectedModel: data.selectedModel,
          knowledgeContext: data.knowledgeContext,
        };
      });
      const edgePayload = snapshotEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
      }));
      return JSON.stringify({
        name: snapshotName.trim(),
        nodes: nodePayload,
        edges: edgePayload,
      });
    },
    [],
  );

  useEffect(() => {
    const snapshot =
      buildWorkflowSnapshot(
        workflowName,
        nodes as WorkflowNode[],
        edges as WorkflowEdge[],
      ) + `|t:${thumbnail ?? ""}`;

    if (isInitialMount.current && lastSavedSnapshotRef.current === null) {
      lastSavedSnapshotRef.current = snapshot;
      isInitialMount.current = false;
      setHasUnsavedChanges(false);
      return;
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }

    if (lastSavedSnapshotRef.current === null) {
      setHasUnsavedChanges(true);
      return;
    }

    setHasUnsavedChanges(snapshot !== lastSavedSnapshotRef.current);
  }, [workflowName, nodes, edges, thumbnail, buildWorkflowSnapshot]);

  // Auto-dismiss the save-status indicator after 3 seconds.
  useEffect(() => {
    if (!saveStatus) return;
    const timer = setTimeout(() => setSaveStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  // Warn the browser when the user tries to close/refresh with unsaved changes.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ── 12. History callbacks ───────────────────────────────────────────────────

  const saveToHistory = useCallback(() => {
    const newHistory = pruneHistory(
      [
        ...history.slice(0, historyIndex + 1),
        { nodes: [...nodes], edges: [...edges] },
      ],
      50,
    );
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevState = history[historyIndex - 1];
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setHistoryIndex(historyIndex - 1);
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setHistoryIndex(historyIndex + 1);
  }, [history, historyIndex, setNodes, setEdges]);

  // ── 13. Edge / connection callbacks ────────────────────────────────────────

  const handleDeleteEdges = useCallback(
    (edgeIds: string[]) => {
      setEdges((eds) => eds.filter((e) => !edgeIds.includes(e.id)));
      setSelectedEdges([]);
      setShowEdgeDetails(false);
      setSelectedEdgeForDetails(null);
      saveToHistory();
    },
    [setEdges, saveToHistory],
  );

  /** Commits a new edge after validating source→target compatibility. */
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      if (!sourceNode || !targetNode) return;

      const sourceType = (sourceNode.data as WorkflowNodeData).type;
      const targetType = (targetNode.data as WorkflowNodeData).type;

      if (
        !validateConnection(
          sourceType,
          targetType,
          nodes,
          edges,
          params.source,
          params.target,
        )
      ) {
        const isContextNode = ["document", "chat", "pin"].includes(targetType);
        if (isContextNode) {
          toast.error("Invalid connection", {
            description: `Context nodes (${targetType}) cannot receive incoming connections. They are source-only nodes.`,
          });
        } else {
          toast.error("Invalid connection", {
            description:
              "This would create a cycle in the workflow. Persona and Model nodes cannot form circular dependencies.",
          });
        }
        return;
      }

      setEdges((eds) => addEdge(params, eds));
      saveToHistory();
    },
    [nodes, edges, setEdges, saveToHistory],
  );

  /** Real-time connection validation used by ReactFlow for visual feedback. */
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceType = (sourceNode.data as WorkflowNodeData).type;
      const targetType = (targetNode.data as WorkflowNodeData).type;
      return validateConnection(
        sourceType,
        targetType,
        nodes,
        edges,
        connection.source,
        connection.target,
      );
    },
    [nodes, edges],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      _event.stopPropagation();
      setSelectedEdges([edge.id]);
      setSelectedNode(null);
      setSelectedEdgeForDetails(edge);
      setShowEdgeDetails(true);
      // Close all open inspector / utility panels.
      setShowInstructions(false);
      setShowDocumentInspector(false);
      setShowChatInspector(false);
      setShowPinInspector(false);
      setShowPersonaInspector(false);
      setShowModelInspector(false);
      setShowWorkflowChat(false);
      setCurrentInstructionsNodeId(null);
      setDocumentNodeId(null);
      setChatNodeId(null);
      setPinNodeId(null);
      setPersonaNodeId(null);
      setModelNodeId(null);
    },
    [],
  );

  // ── 14. Drag & drop / node mutation callbacks ───────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  /**
   * Adds a new node to the canvas at the specified position.
   *
   * INVARIANT: This function MUST NEVER remove, replace, or modify any existing
   * node.  It only adds the new node and removes the phantom placeholder.
   */
  const addNode = useCallback(
    (type: NodeType, position?: { x: number; y: number }) => {
      const baseName = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
      const sameTypeNodes = nodes.filter(
        (n) => (n.data as WorkflowNodeData).type === type,
      );

      const counterPattern = /\((\d+)\)$/;
      const existingCounters = sameTypeNodes
        .map((n) => {
          const label = (n.data as WorkflowNodeData).label || "";
          const match = label.match(counterPattern);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((num) => num > 0);

      let nodeName: string;
      if (sameTypeNodes.length === 0) {
        nodeName = baseName;
      } else if (existingCounters.length === 0) {
        nodeName = `${baseName} (1)`;
      } else {
        nodeName = `${baseName} (${Math.max(...existingCounters) + 1})`;
      }

      const realNodes = nodes.filter((n) => n.id !== "phantom-node");
      let resolvedPosition = position || {
        x: 300 + realNodes.length * 20,
        y: 300 + realNodes.length * 20,
      };
      const OVERLAP_THRESHOLD = 30;
      if (
        realNodes.some(
          (n) =>
            Math.abs(n.position.x - resolvedPosition.x) < OVERLAP_THRESHOLD &&
            Math.abs(n.position.y - resolvedPosition.y) < OVERLAP_THRESHOLD,
        )
      ) {
        resolvedPosition = {
          x: resolvedPosition.x + 40,
          y: resolvedPosition.y + 40,
        };
      }

      const newNode = {
        id: getId(),
        type: "custom",
        position: resolvedPosition,
        data: {
          label: nodeName,
          name: nodeName,
          type,
          status: "idle",
          description: "",
          config: {},
        } as WorkflowNodeData,
      };

      // CRITICAL: Only remove phantom; preserve ALL existing real nodes.
      setNodes((currentNodes) => {
        const realExisting = currentNodes.filter((n) => n.id !== "phantom-node");
        if (realExisting.some((n) => n.id === newNode.id)) {
          console.error(
            "[useWorkflowState] Node id collision detected – generating a safe fallback id.",
          );
          newNode.id = `node_${crypto.randomUUID()}`;
        }
        return [...realExisting, newNode];
      });
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== "phantom-node" && e.target !== "phantom-node",
        ),
      );
      saveToHistory();
      setHasUnsavedChanges(true);
    },
    [nodes, setNodes, setEdges, saveToHistory],
  );

  /** Adds a node at the current viewport centre (palette click). */
  const onNodeClickFromPalette = useCallback(
    (nodeType: NodeType) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      addNode(nodeType, { x: centerX - 140, y: centerY - 44 });
    },
    [getViewport, addNode],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(type as NodeType, position);
    },
    [screenToFlowPosition, addNode],
  );

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node as Node<WorkflowNodeData>);
    },
    [],
  );

  /** When a node finishes dragging, remove the phantom if it's still present. */
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      if (!node || node.id === "phantom-node") return;
      setNodes((nds) => nds.filter((n) => n.id !== "phantom-node"));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== "phantom-node" && e.target !== "phantom-node",
        ),
      );
      saveToHistory();
    },
    [setNodes, setEdges, saveToHistory],
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== nodeId) return node;
          const updatedData = data.name ? { ...data, label: data.name } : data;
          return { ...node, data: { ...node.data, ...updatedData } };
        }),
      );
      saveToHistory();
    },
    [setNodes, saveToHistory],
  );

  // ── 15. Selection / pane callbacks ─────────────────────────────────────────

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      _event.stopPropagation();
      const nodeData = node.data as WorkflowNodeData;
      setSelectedNode(node as Node<WorkflowNodeData>);
      setSelectedEdges([]);
      setHighlightedNodeType(nodeData.type);
      // Close all panels.
      setShowInstructions(false);
      setShowDocumentInspector(false);
      setShowChatInspector(false);
      setShowPinInspector(false);
      setShowPersonaInspector(false);
      setShowModelInspector(false);
      setShowWorkflowChat(false);
      // Open the appropriate inspector.
      if (nodeData.type === "document") {
        setDocumentNodeId(node.id);
        setShowDocumentInspector(true);
      } else if (nodeData.type === "chat") {
        setChatNodeId(node.id);
        setShowChatInspector(true);
      } else if (nodeData.type === "pin") {
        setPinNodeId(node.id);
        setShowPinInspector(true);
      } else if (nodeData.type === "persona") {
        setPersonaNodeId(node.id);
        setShowPersonaInspector(true);
      } else if (nodeData.type === "model") {
        setModelNodeId(node.id);
        setShowModelInspector(true);
      }
    },
    [],
  );

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
    setShowEdgeDetails(false);
    setSelectedEdgeForDetails(null);
    // Note: workflow chat is NOT closed on pane click — user must close it explicitly.
  }, []);

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

  // ── 16. Inspector open / close / update callbacks ───────────────────────────

  const handleOpenInstructions = useCallback(
    (nodeId: string) => {
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
      const node = nodes.find((n) => n.id === nodeId);
      setInstructions(node?.data?.instructions ?? "");
    },
    [nodes],
  );

  const handleCloseInstructions = useCallback(() => {
    setShowInstructions(false);
    setCurrentInstructionsNodeId(null);
  }, []);

  const handleClearInstructions = useCallback(() => {
    setInstructions("");
    if (currentInstructionsNodeId) {
      handleUpdateNode(currentInstructionsNodeId, { instructions: "" });
      toast.info("Instructions cleared");
    }
  }, [currentInstructionsNodeId, handleUpdateNode]);

  const handleSaveInstructions = useCallback(
    (value: string) => {
      setInstructions(value);
      if (currentInstructionsNodeId) {
        handleUpdateNode(currentInstructionsNodeId, { instructions: value });
      }
    },
    [currentInstructionsNodeId, handleUpdateNode],
  );

  const handleSaveAndClose = useCallback(() => {
    if (currentInstructionsNodeId) {
      handleUpdateNode(currentInstructionsNodeId, { instructions });
      toast.success("Instructions saved");
    }
    handleCloseInstructions();
  }, [currentInstructionsNodeId, instructions, handleUpdateNode, handleCloseInstructions]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSaveAndClose();
      }
    },
    [handleSaveAndClose],
  );

  // Document
  const handleCloseDocumentInspector = useCallback(() => {
    setShowDocumentInspector(false);
    setDocumentNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdateDocumentNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) =>
      handleUpdateNode(nodeId, data),
    [handleUpdateNode],
  );

  // Chat
  const handleCloseChatInspector = useCallback(() => {
    setShowChatInspector(false);
    setChatNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdateChatNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) =>
      handleUpdateNode(nodeId, data),
    [handleUpdateNode],
  );

  // Pin
  const handleClosePinInspector = useCallback(() => {
    setShowPinInspector(false);
    setPinNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdatePinNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) =>
      handleUpdateNode(nodeId, data),
    [handleUpdateNode],
  );

  // Persona
  const handleClosePersonaInspector = useCallback(() => {
    setShowPersonaInspector(false);
    setPersonaNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdatePersonaNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) =>
      handleUpdateNode(nodeId, data),
    [handleUpdateNode],
  );

  // Model
  const handleCloseModelInspector = useCallback(() => {
    setShowModelInspector(false);
    setModelNodeId(null);
    setSelectedNode(null);
  }, []);

  const handleUpdateModelNode = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) =>
      handleUpdateNode(nodeId, data),
    [handleUpdateNode],
  );

  // ── Node deletion ────────────────────────────────────────────────────────────

  /**
   * Deletes a node by id.  Prevents deletion of the Start / End control nodes.
   * Also closes any inspector that was showing the deleted node.
   */
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === "start-node" || nodeId === "end-node") {
        toast.error("Cannot delete", {
          description:
            "Start and End trigger nodes cannot be deleted. They are required for workflow execution.",
        });
        return;
      }
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
      if (selectedNode?.id === nodeId) setSelectedNode(null);
      // Close the inspector for the deleted node.
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
    [
      selectedNode,
      documentNodeId,
      chatNodeId,
      pinNodeId,
      personaNodeId,
      modelNodeId,
      setNodes,
      setEdges,
      saveToHistory,
    ],
  );

  const handleDeleteDocumentNode = useCallback(
    (nodeId: string) => {
      handleDeleteNode(nodeId);
      setShowDocumentInspector(false);
      setDocumentNodeId(null);
      setSelectedNode(null);
    },
    [handleDeleteNode],
  );

  /** Deletes the currently selected node (context-menu wrapper). */
  const handleDelete = useCallback(() => {
    if (!selectedNode) return;
    handleDeleteNode(selectedNode.id);
  }, [selectedNode, handleDeleteNode]);

  /** Deletes the currently selected node (inspector wrapper). */
  const handleDeleteFromInspector = useCallback(() => {
    if (selectedNode) handleDeleteNode(selectedNode.id);
  }, [selectedNode, handleDeleteNode]);

  /**
   * Duplicates the currently selected node with auto-incremented counter naming.
   * Start and End control nodes cannot be duplicated.
   */
  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return;
    const nodeData = selectedNode.data as WorkflowNodeData;
    if (nodeData.type === "start" || nodeData.type === "end") {
      toast.error("Cannot duplicate", {
        description:
          "Start and End nodes cannot be duplicated. These are unique control nodes required for workflow execution.",
      });
      return;
    }

    const baseName = `${nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)}`;
    const sameTypeNodes = nodes.filter(
      (n) => (n.data as WorkflowNodeData).type === nodeData.type,
    );
    const counterPattern = /\((\d+)\)$/;
    const existingCounters = sameTypeNodes
      .map((n) => {
        const label = (n.data as WorkflowNodeData).label || "";
        const match = label.match(counterPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => num > 0);

    const newNodeName =
      existingCounters.length === 0
        ? `${baseName} (1)`
        : `${baseName} (${Math.max(...existingCounters) + 1})`;

    const newNode = {
      ...selectedNode,
      id: getId(),
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50,
      },
      selected: false,
      data: { ...selectedNode.data, label: newNodeName, name: newNodeName },
    };

    setNodes((nds) => [
      ...nds.filter((n) => n.id !== "phantom-node"),
      newNode,
    ]);
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== "phantom-node" && e.target !== "phantom-node",
      ),
    );
    saveToHistory();
  }, [selectedNode, nodes, setNodes, setEdges, saveToHistory]);

  // ── Keyboard shortcuts (Delete / Backspace) ─────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      event.preventDefault();
      if (selectedNode) handleDeleteNode(selectedNode.id);
      if (selectedEdges.length > 0) handleDeleteEdges(selectedEdges);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, selectedEdges, handleDeleteNode, handleDeleteEdges]);

  // ── 17. Persistence callbacks ───────────────────────────────────────────────

  /** Clears the canvas (shows confirmation dialog). */
  const handleClear = useCallback(() => {
    setIsClearDialogOpen(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    setNodes([...INITIAL_NODES, PHANTOM_NODE]);
    setEdges(INITIAL_EDGES);
    setSelectedNode(null);
    saveToHistory();
    setIsClearDialogOpen(false);
  }, [setNodes, setEdges, saveToHistory]);

  /**
   * Saves the workflow to the backend.  Enforces plan limits for new workflows.
   * Returns true if the save was successful, false otherwise.
   */
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (
      !workflowId &&
      user?.planType &&
      hasReachedLimit(user.planType, "workflows", workflowCount)
    ) {
      setShowWorkflowUpgradeDialog(true);
      return false;
    }

    const trimmedName = workflowName.trim();
    if (!trimmedName || trimmedName.toLowerCase() === "untitled workflow") {
      toast.error("Workflow name required", {
        description: "Rename your workflow before saving.",
      });
      return false;
    }

    // Inline canTestWorkflow computation (avoids stale closure from derived value).
    const normalizedName = workflowName.trim();
    const hasCustomTitle =
      normalizedName.length > 0 &&
      normalizedName.toLowerCase() !== "untitled workflow";
    const hasReasoningModel = nodes.some((node) => {
      if (node.id === "phantom-node") return false;
      const data = node.data as WorkflowNodeData;
      if (data.type === "persona") {
        return (
          (data.selectedPersona || "").toString().trim().length > 0 &&
          (data.instructions || "").toString().trim().length > 0
        );
      }
      if (data.type === "model") {
        return (
          (data.selectedModel || data.modelId || "").toString().trim().length > 0 &&
          (data.instructions || "").toString().trim().length > 0
        );
      }
      return false;
    });
    const canTest = hasCustomTitle && hasReasoningModel;

    if (!canTest) {
      toast.error("Configure workflow before saving", {
        description:
          "Add and configure at least one reasoning model node (with model and instruction) or persona node (with persona and instruction).",
      });
      return false;
    }

    const validation = validateWorkflow(nodes, edges);
    if (!validation.valid) {
      toast.error("Cannot save workflow", {
        description: validation.errors.join(", "),
      });
      return false;
    }

    try {
      setIsSaving(true);
      setSaveStatus("Saving...");
      const viewport = getViewport();
      const workflowDTO = serializeWorkflow(trimmedName, nodes, edges, viewport);
      if (thumbnail) workflowDTO.thumbnail = thumbnail;
      const saved = await workflowAPI.upsert(workflowId, workflowDTO);
      const effectiveId = saved.id || workflowId;
      if (saved.id && saved.id !== workflowId) {
        setWorkflowId(saved.id);
      }

      let finalThumbnail = thumbnail;
      if (thumbnailFile && effectiveId) {
        const uploadedUrl = await workflowAPI.uploadThumbnail(
          effectiveId,
          thumbnailFile,
        );
        if (uploadedUrl) {
          finalThumbnail = uploadedUrl;
          setThumbnail(uploadedUrl);
          setThumbnailFile(null);
        }
      }

      lastSavedSnapshotRef.current =
        buildWorkflowSnapshot(
          trimmedName,
          nodes as WorkflowNode[],
          edges as WorkflowEdge[],
        ) + `|t:${finalThumbnail ?? ""}`;
      setHasUnsavedChanges(false);
      setSaveStatus("Saved");
      return true;
    } catch (error) {
      console.error("[useWorkflowState] Save failed:", error);
      toast.error("Failed to save workflow", { description: "Please try again." });
      setSaveStatus("Save failed");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    workflowId,
    nodes,
    edges,
    workflowName,
    thumbnail,
    thumbnailFile,
    getViewport,
    buildWorkflowSnapshot,
    user,
    workflowCount,
  ]);

  /** Loads a workflow from localStorage (legacy fallback). */
  const handleLoad = useCallback(() => {
    const saved = localStorage.getItem("workflow");
    if (!saved) return;
    const workflow = JSON.parse(saved);
    setNodes(workflow.nodes || []);
    setEdges(workflow.edges || []);
    setWorkflowName(workflow.name || "Untitled Workflow");
    if (workflow.id) setWorkflowId(workflow.id);
    if (workflow.viewport) setViewport(workflow.viewport);
    setSaveStatus(null);
    lastSavedSnapshotRef.current =
      buildWorkflowSnapshot(
        workflow.name || "Untitled Workflow",
        (workflow.nodes || []) as WorkflowNode[],
        (workflow.edges || []) as WorkflowEdge[],
      ) + `|t:`;
    setHasUnsavedChanges(false);
    saveToHistory();
  }, [setNodes, setEdges, setViewport, saveToHistory, buildWorkflowSnapshot]);

  /** Loads a workflow from the backend API (opens from workflow admin list). */
  const handleLoadWorkflow = useCallback(
    async (id: string) => {
      try {
        const workflowDTO = await workflowAPI.get(id);
        setNodes(workflowDTO.nodes || []);
        setEdges(workflowDTO.edges || []);
        setWorkflowName(workflowDTO.name || "Untitled Workflow");
        setWorkflowId(id);
        const loadedThumbnail = workflowDTO.thumbnail || null;
        setThumbnail(loadedThumbnail);
        if (workflowDTO.viewport) setViewport(workflowDTO.viewport);
        setSaveStatus(null);
        lastSavedSnapshotRef.current =
          buildWorkflowSnapshot(
            workflowDTO.name || "Untitled Workflow",
            (workflowDTO.nodes || []) as WorkflowNode[],
            (workflowDTO.edges || []) as WorkflowEdge[],
          ) + `|t:${loadedThumbnail ?? ""}`;
        setHasUnsavedChanges(false);
        saveToHistory();
      } catch (error) {
        console.error("[useWorkflowState] Failed to load workflow:", error);
        toast.error("Failed to load workflow", {
          description: "Please try again.",
        });
      }
    },
    [setNodes, setEdges, setViewport, saveToHistory, buildWorkflowSnapshot],
  );

  // Load workflow / chat-mode from URL query params on first mount.
  useEffect(() => {
    if (hasLoadedQueryWorkflow.current) return;
    hasLoadedQueryWorkflow.current = true;

    const workflowIdFromQuery = searchParams.get("id");
    const openChatMode = searchParams.get("chatMode") === "true";

    const openChatPanel = () => {
      setShowInstructions(false);
      setShowDocumentInspector(false);
      setShowChatInspector(false);
      setShowPinInspector(false);
      setShowPersonaInspector(false);
      setShowModelInspector(false);
      setShowEdgeDetails(false);
      setShowWorkflowChat(true);
    };

    if (workflowIdFromQuery) {
      handleLoadWorkflow(workflowIdFromQuery).finally(() => {
        if (openChatMode) openChatPanel();
      });
      return;
    }

    if (openChatMode) openChatPanel();
  }, [searchParams, handleLoadWorkflow]);

  /** Opens the floating workflow chat overlay (Test mode). */
  const handleTest = useCallback(() => {
    if (!workflowId) return;
    setShowInstructions(false);
    setShowDocumentInspector(false);
    setShowChatInspector(false);
    setShowPinInspector(false);
    setShowPersonaInspector(false);
    setShowModelInspector(false);
    setShowEdgeDetails(false);
    setShowWorkflowChat(true);
    router.replace(`/workflows?id=${workflowId}&chatMode=true`);
  }, [workflowId, router]);

  /** Navigates to the full-page workflow chat experience (Run mode). */
  const handleRun = useCallback(() => {
    if (!workflowId) return;
    router.push(`/workflows/${workflowId}/chat`);
  }, [workflowId, router]);

  /** Navigates back to the workflow admin list, prompting if there are unsaved changes. */
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
    } else {
      router.push("/workflows/admin");
    }
  }, [hasUnsavedChanges, router]);

  const handleShare = useCallback(() => {
    toast.info("Share functionality", {
      description:
        "This would generate a shareable link or export the workflow",
    });
  }, []);

  // ── 18. Execution callbacks ─────────────────────────────────────────────────

  /**
   * Processes a single node during local (offline) execution.
   * This is used only by the legacy local executeWorkflow path; live streaming
   * execution is handled by the WorkflowChatInterface via useWorkflowChat.
   */
  const processNode = useCallback(
    async (nodeId: string): Promise<unknown> => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const nodeData = node.data as WorkflowNodeData;
      const parentEdges = edges.filter((e) => e.target === nodeId);
      const inputData = parentEdges
        .map((edge) => nodes.find((n) => n.id === edge.source)?.data?.output)
        .filter(Boolean);

      switch (nodeData.type) {
        case "start":
          return {
            message: "Workflow started",
            timestamp: new Date().toISOString(),
          };
        case "document":
          return {
            type: "document",
            files: nodeData.files || [],
            content: `Document context with ${nodeData.files?.length || 0} files`,
          };
        case "chat":
          return {
            type: "chat",
            messages: nodeData.config?.messages || [],
            context: inputData,
          };
        case "pin":
          return {
            type: "pin",
            pinnedItems: nodeData.config?.pinnedItems || [],
            context: inputData,
          };
        case "persona":
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {
            type: "persona",
            personaId: nodeData.config?.personaId,
            processedContext: inputData,
            reasoning: `Processed by persona: ${nodeData.label}`,
          };
        case "model":
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return {
            type: "model",
            modelId: nodeData.modelId,
            input: inputData,
            output: `Model output from ${nodeData.label}`,
            tokens: Math.floor(Math.random() * 1000),
          };
        case "end":
          return {
            message: "Workflow completed",
            timestamp: new Date().toISOString(),
            finalOutput: inputData,
          };
        default:
          return inputData;
      }
    },
    [nodes, edges],
  );

  const executeWorkflow = useCallback(async () => {
    if (isExecuting) return;
    const validation = validateWorkflow(nodes, edges);
    if (!validation.valid) {
      toast.error("Cannot execute workflow", {
        description: validation.errors.join(", "),
      });
      return;
    }
    const order = topologicalSort(nodes, edges);
    if (!order) {
      toast.error("Cannot execute workflow", {
        description: "Cycle detected or invalid graph structure",
      });
      return;
    }

    setIsExecuting(true);
    setExecutionOrder(order);
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, status: "idle" as const, output: undefined },
      })),
    );

    for (const nodeId of order) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, status: "running" as const } }
            : node,
        ),
      );
      try {
        const output = await processNode(nodeId);
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: { ...node.data, status: "success" as const, output },
                }
              : node,
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[useWorkflowState] Error processing node ${nodeId}:`, error);
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, status: "error" as const } }
              : node,
          ),
        );
        break;
      }
    }

    setIsExecuting(false);
  }, [isExecuting, processNode, setNodes, nodes, edges]);

  const resetWorkflow = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, status: "idle" as const, output: undefined },
      })),
    );
    setIsExecuting(false);
    setExecutionOrder([]);
  }, [setNodes]);

  /**
   * Resets all node statuses to idle before a streaming chat run starts.
   * Called by WorkflowChatInterface's onRunStart prop.
   */
  const handleRunStart = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "phantom-node") return node;
        return {
          ...node,
          data: {
            ...node.data,
            status: "idle" as NodeStatus,
            output: undefined,
          },
        };
      }),
    );
  }, [setNodes]);

  /**
   * Updates a node's status and optional output in response to a streaming
   * chat event.  Called by WorkflowChatInterface's onNodeStatusChange prop.
   */
  const handleNodeStatusChange = useCallback(
    (nodeId: string, status: NodeStatus, output?: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              status,
              ...(output !== undefined ? { output } : {}),
            },
          };
        }),
      );
    },
    [setNodes],
  );

  // ── Derived values ────────────────────────────────────────────────────────────

  const normalizedWorkflowName = workflowName.trim();
  const hasCustomWorkflowTitle =
    normalizedWorkflowName.length > 0 &&
    normalizedWorkflowName.toLowerCase() !== "untitled workflow";
  const hasConfiguredReasoningModel = nodes.some((node) => {
    if (node.id === "phantom-node") return false;
    const data = node.data as WorkflowNodeData;
    if (data.type === "persona") {
      return (
        (data.selectedPersona || "").toString().trim().length > 0 &&
        (data.instructions || "").toString().trim().length > 0
      );
    }
    if (data.type === "model") {
      return (
        (data.selectedModel || data.modelId || "").toString().trim().length > 0 &&
        (data.instructions || "").toString().trim().length > 0
      );
    }
    return false;
  });
  const canTestWorkflow = hasCustomWorkflowTitle && hasConfiguredReasoningModel;
  const testWorkflowDisabledReason = !hasCustomWorkflowTitle
    ? "Rename workflow from 'Untitled Workflow' before testing."
    : !hasConfiguredReasoningModel
      ? "Add a configured model node (with model and instruction) or persona node (with persona and instruction) before testing."
      : undefined;

  /**
   * Closes the edge-details dialog and clears the edge selection without
   * disturbing any open node inspector.  The original code did this inline;
   * exposing it as a callback avoids leaking raw setters into the component.
   */
  const handleCloseEdgeDetails = useCallback(() => {
    setShowEdgeDetails(false);
    setSelectedEdgeForDetails(null);
    setSelectedEdges([]);
  }, []);

  /** Helper consumed by LeftSidebar palette items and context menu. */
  const getNodeCategoryHelper = useCallback(
    (nodeType: string) => getNodeCategory(nodeType),
    [],
  );

  // ── 19. Return value ──────────────────────────────────────────────────────────

  return {
    // ── ReactFlow viewport helpers (re-exported for JSX usage) ────────────────
    fitView,
    zoomIn,
    zoomOut,

    // ── Nodes & edges ─────────────────────────────────────────────────────────
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNode,
    setSelectedNode,
    selectedEdges,

    // ── History ───────────────────────────────────────────────────────────────
    history,
    historyIndex,
    handleUndo,
    handleRedo,

    // ── Workflow metadata ─────────────────────────────────────────────────────
    workflowName,
    setWorkflowName,
    workflowId,
    saveStatus,
    hasUnsavedChanges,
    isSaving,
    thumbnail,
    setThumbnail,
    thumbnailFile,
    setThumbnailFile,

    // ── Canvas UI preferences ────────────────────────────────────────────────
    snapToGrid,
    setSnapToGrid,
    showMinimap,
    setShowMinimap,
    highlightedNodeType,
    contextMenu,
    setContextMenu,

    // ── Inspector / panel state ───────────────────────────────────────────────
    showInstructions,
    currentInstructionsNodeId,
    instructions,
    setInstructions,
    showDocumentInspector,
    documentNodeId,
    showChatInspector,
    chatNodeId,
    showPinInspector,
    pinNodeId,
    showPersonaInspector,
    personaNodeId,
    showModelInspector,
    modelNodeId,
    showEdgeDetails,
    selectedEdgeForDetails,
    showWorkflowChat,
    setShowWorkflowChat,

    // ── External API data ─────────────────────────────────────────────────────
    allChats,
    allPins,
    allPersonas,
    allModels,

    // ── Execution ────────────────────────────────────────────────────────────
    isExecuting,
    executionOrder,
    executeWorkflow,
    resetWorkflow,
    handleRunStart,
    handleNodeStatusChange,

    // ── Plan-limit & dialogs ─────────────────────────────────────────────────
    workflowCount,
    user,
    showWorkflowUpgradeDialog,
    setShowWorkflowUpgradeDialog,
    showLoadDialog,
    setShowLoadDialog,
    isClearDialogOpen,
    setIsClearDialogOpen,
    showLeaveConfirm,
    setShowLeaveConfirm,

    // ── Derived values ────────────────────────────────────────────────────────
    canTestWorkflow,
    testWorkflowDisabledReason,

    // ── Callbacks ────────────────────────────────────────────────────────────
    // Node / edge operations
    onConnect,
    isValidConnection,
    onEdgeClick,
    onDragOver,
    onDragStart,
    addNode,
    onNodeClickFromPalette,
    onDrop,
    onNodeDragStart,
    onNodeDragStop,
    handleUpdateNode,
    handleDeleteNode,
    handleDeleteDocumentNode,
    handleDelete,
    handleDeleteFromInspector,
    handleDuplicate,
    handleDeleteEdges,
    // Selection / pane
    onNodeClick,
    onPaneClick,
    onPaneContextMenu,
    onNodeContextMenu,
    // Instructions panel
    handleOpenInstructions,
    handleCloseInstructions,
    handleClearInstructions,
    handleSaveInstructions,
    handleSaveAndClose,
    handleTextareaKeyDown,
    // Inspector close / update
    handleCloseDocumentInspector,
    handleUpdateDocumentNode,
    handleCloseChatInspector,
    handleUpdateChatNode,
    handleClosePinInspector,
    handleUpdatePinNode,
    handleClosePersonaInspector,
    handleUpdatePersonaNode,
    handleCloseModelInspector,
    handleUpdateModelNode,
    // Persistence
    handleSave,
    handleLoad,
    handleLoadWorkflow,
    handleClear,
    handleConfirmClear,
    handleTest,
    handleRun,
    handleBack,
    handleShare,
    // Edge details
    handleCloseEdgeDetails,
    // Utility
    getNodeCategoryHelper,
  };
}

/** Convenience type alias for consumers. */
export type WorkflowStateReturn = ReturnType<typeof useWorkflowState>;
