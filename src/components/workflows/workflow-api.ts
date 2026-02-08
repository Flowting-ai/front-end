import { WorkflowDTO, WorkflowMetadata, ExecutionResult } from "./types";
import {
  API_BASE_URL,
  MODELS_ENDPOINT,
  PERSONAS_ENDPOINT,
  PINS_ENDPOINT as CONFIG_PINS_ENDPOINT,
  CSRF_INIT_ENDPOINT,
} from "@/lib/config";
import { apiFetch } from "@/lib/api/client";

const WORKFLOWS_ENDPOINT = `${API_BASE_URL}/api/workflows/`;
const PINS_ENDPOINT = CONFIG_PINS_ENDPOINT;

type FrontendNodeType =
  | "start"
  | "end"
  | "document"
  | "chat"
  | "pin"
  | "persona"
  | "model"
  | "phantom";

interface BackendKnowledgeBaseItem {
  kb_type: "chat" | "pin";
  kb_id: string;
  instruction?: string;
  position_x?: number;
  position_y?: number;
}

interface BackendWorkflowNodePayload {
  node_id: string;
  node_type: "start" | "end" | "process";
  position_x: number;
  position_y: number;
  model_id?: string;
  persona_id?: string;
  instructions?: string;
  knowledge_bases?: BackendKnowledgeBaseItem[];
}

interface BackendWorkflowEdgePayload {
  source_node_id: string;
  target_node_id: string;
  label?: string;
}

interface BackendWorkflowCreatePayload {
  name: string;
  description?: string;
  nodes: BackendWorkflowNodePayload[];
  edges: BackendWorkflowEdgePayload[];
}

interface BackendWorkflowListItem {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  nodes_count: number;
  edges_count: number;
  runs_count: number;
  created_at: string;
  updated_at: string;
}

interface BackendWorkflowNode {
  id?: string;
  node_id: string;
  node_type: "start" | "end" | "process";
  position_x: number;
  position_y: number;
  model_id?: number | string | null;
  model_name?: string | null;
  persona_id?: string | null;
  persona_name?: string | null;
  instructions?: string;
  knowledge_bases?: BackendKnowledgeBaseItem[];
  created_at?: string;
}

interface BackendWorkflowEdge {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
  created_at?: string;
}

interface PreprocessedKnowledgeItem {
  kb_type: "chat" | "pin";
  instruction?: string;
  context?: string;
  position_x?: number;
  position_y?: number;
  node_id?: string;
}

interface BackendWorkflowDetail {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  nodes: BackendWorkflowNode[];
  edges: BackendWorkflowEdge[];
  preprocessed_knowledge?: Record<string, PreprocessedKnowledgeItem>;
}

interface BackendWorkflowCreateResponse {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface BackendWorkflowExecutionResponse {
  run_id?: string;
  status: string;
  final_output?: string;
  total_cost?: number;
  execution_metadata?: Record<string, unknown>;
  error?: string;
}

interface BackendWorkflowRunSummary {
  run_id: string;
  status: string;
  input_text?: string;
  final_output?: string;
  started_at?: string;
  completed_at?: string | null;
  error_message?: string;
  execution_metadata?: Record<string, unknown>;
}

class WorkflowAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "WorkflowAPIError";
  }
}

const DEFAULT_TIMEOUT = 30000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value && UUID_REGEX.test(value));

const asString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
};

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
  }
  const single = asString(value);
  return single ? [single] : [];
};

const parseJsonSafe = async (response: Response): Promise<unknown> => {
  const raw = await response.text().catch(() => "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorPayload = (await parseJsonSafe(response)) as
      | Record<string, unknown>
      | null;
    const message =
      errorPayload?.message ||
      errorPayload?.detail ||
      errorPayload?.error ||
      response.statusText ||
      "API request failed";
    throw new WorkflowAPIError(
      typeof message === "string" ? message : "API request failed",
      response.status,
      typeof errorPayload?.code === "string" ? errorPayload.code : undefined
    );
  }

  const payload = await parseJsonSafe(response);
  return payload as T;
};

const ensureCsrfToken = async () => {
  if (typeof document === "undefined") return;
  if (document.cookie.includes("csrftoken=")) return;

  try {
    await apiFetch(CSRF_INIT_ENDPOINT, { method: "GET" });
  } catch {
    // Best-effort only. Request may still succeed if CSRF cookie already exists server-side.
  }
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = DEFAULT_TIMEOUT
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const method = (options.method || "GET").toUpperCase();

  try {
    if (method !== "GET") {
      await ensureCsrfToken();
    }

    const response = await apiFetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new WorkflowAPIError("Request timeout", 408, "TIMEOUT");
    }
    throw error;
  }
};

const workflowDetailEndpoint = (id: string) =>
  `${WORKFLOWS_ENDPOINT}${encodeURIComponent(id)}/`;

const workflowExecuteEndpoint = (id: string) =>
  `${WORKFLOWS_ENDPOINT}${encodeURIComponent(id)}/execute/`;

const workflowRunsEndpoint = (id: string) =>
  `${WORKFLOWS_ENDPOINT}${encodeURIComponent(id)}/runs/`;

const CONTEXT_NODE_TYPES = new Set<FrontendNodeType>([
  "chat",
  "pin",
  "document",
  "phantom",
]);

const dedupeKnowledgeBases = (
  items: BackendKnowledgeBaseItem[]
): BackendKnowledgeBaseItem[] => {
  const seen = new Set<string>();
  const result: BackendKnowledgeBaseItem[] = [];

  for (const item of items) {
    const key = `${item.kb_type}:${item.kb_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
};

const toBackendWorkflowPayload = (
  workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt"> | WorkflowDTO
): BackendWorkflowCreatePayload => {
  // DEBUG: Log input workflow
  console.log("[toBackendWorkflowPayload] INPUT workflow.nodes:", workflow.nodes.map(n => ({
    id: n.id,
    type: n.data?.type,
    selectedModel: n.data?.selectedModel,
    selectedPersona: n.data?.selectedPersona,
  })));
  console.log("[toBackendWorkflowPayload] INPUT workflow.edges:", workflow.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
  })));

  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));

  const keptNodes = workflow.nodes.filter((node) => {
    const nodeType = (node.data?.type || "") as FrontendNodeType;
    return !CONTEXT_NODE_TYPES.has(nodeType);
  });

  const keptNodeIds = new Set(keptNodes.map((node) => node.id));
  const processNodeIds = new Set(
    keptNodes
      .filter((node) => {
        const nodeType = (node.data?.type || "") as FrontendNodeType;
        return nodeType !== "start" && nodeType !== "end";
      })
      .map((node) => node.id)
  );

  const knowledgeByTarget = new Map<string, BackendKnowledgeBaseItem[]>();

  // Build adjacency lists for computing transitive edges
  const incomingEdges = new Map<string, Set<string>>(); // nodeId -> set of source nodeIds
  const outgoingEdges = new Map<string, Set<string>>(); // nodeId -> set of target nodeIds

  for (const node of workflow.nodes) {
    incomingEdges.set(node.id, new Set());
    outgoingEdges.set(node.id, new Set());
  }

  for (const edge of workflow.edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    // Build adjacency lists
    incomingEdges.get(edge.target)?.add(edge.source);
    outgoingEdges.get(edge.source)?.add(edge.target);

    // Collect knowledge bases from context nodes
    const sourceType = (sourceNode.data?.type || "") as FrontendNodeType;
    if (sourceType !== "chat" && sourceType !== "pin") continue;
    if (!processNodeIds.has(targetNode.id)) continue;

    const sourceInstruction = asString(sourceNode.data?.instructions) || "";
    const sourcePositionX = Number(sourceNode.position?.x ?? 0);
    const sourcePositionY = Number(sourceNode.position?.y ?? 0);
    const list = knowledgeByTarget.get(targetNode.id) || [];

    if (sourceType === "chat") {
      for (const chatId of asStringArray(sourceNode.data?.selectedChats)) {
        list.push({
          kb_type: "chat",
          kb_id: chatId,
          instruction: sourceInstruction,
          position_x: sourcePositionX,
          position_y: sourcePositionY,
        });
      }
    }

    if (sourceType === "pin") {
      for (const pinId of asStringArray(sourceNode.data?.selectedPins)) {
        list.push({
          kb_type: "pin",
          kb_id: pinId,
          instruction: sourceInstruction,
          position_x: sourcePositionX,
          position_y: sourcePositionY,
        });
      }
    }

    if (list.length) {
      knowledgeByTarget.set(targetNode.id, list);
    }
  }

  // Compute transitive edges: when context nodes are removed, connect their predecessors to successors
  // This ensures the execution graph remains connected
  const transitiveEdges = new Set<string>(); // "sourceId->targetId" format

  // Helper to find all reachable kept nodes from a given node
  const findReachableKeptNodes = (
    startNodeId: string,
    visited: Set<string>
  ): Set<string> => {
    const result = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // If this is a kept node, add it to results
      if (keptNodeIds.has(currentId)) {
        result.add(currentId);
        continue; // Don't traverse further from kept nodes
      }

      // Otherwise, traverse to successors
      const successors = outgoingEdges.get(currentId) || new Set();
      for (const successor of successors) {
        if (!visited.has(successor)) {
          queue.push(successor);
        }
      }
    }

    return result;
  };

  // For each kept node, find all reachable kept nodes through context nodes
  for (const keptNodeId of keptNodeIds) {
    const directSuccessors = outgoingEdges.get(keptNodeId) || new Set();

    for (const successor of directSuccessors) {
      if (keptNodeIds.has(successor)) {
        // Direct edge to another kept node - keep it
        transitiveEdges.add(`${keptNodeId}->${successor}`);
      } else {
        // Successor is a context node - find all reachable kept nodes through it
        const visited = new Set<string>([keptNodeId]);
        const reachable = findReachableKeptNodes(successor, visited);
        for (const reachableId of reachable) {
          transitiveEdges.add(`${keptNodeId}->${reachableId}`);
        }
      }
    }
  }

  const backendNodes: BackendWorkflowNodePayload[] = keptNodes.map((node) => {
    const frontendType = (node.data?.type || "") as FrontendNodeType;
    const isStart = frontendType === "start";
    const isEnd = frontendType === "end";
    const backendNodeType: "start" | "end" | "process" = isStart
      ? "start"
      : isEnd
      ? "end"
      : "process";

    const payload: BackendWorkflowNodePayload = {
      node_id: node.id,
      node_type: backendNodeType,
      position_x: Number(node.position?.x ?? 0),
      position_y: Number(node.position?.y ?? 0),
    };

    if (backendNodeType === "process") {
      const instructions =
        asString(node.data?.instructions) ||
        asString(node.data?.prompt) ||
        asString(node.data?.systemPrompt) ||
        "";
      if (instructions) {
        payload.instructions = instructions;
      }

      const modelId = asString(node.data?.selectedModel || node.data?.modelId);
      const personaId = asString(node.data?.selectedPersona);
      const isPersonaNode = frontendType === "persona";
      const isModelNode = frontendType === "model";

      // Keep persona_id and model_id independent.
      if (isPersonaNode) {
        if (personaId) payload.persona_id = personaId;
      } else if (isModelNode) {
        if (modelId) payload.model_id = modelId;
      } else {
        if (modelId) payload.model_id = modelId;
        if (personaId) payload.persona_id = personaId;
      }

      const knowledge = dedupeKnowledgeBases(
        knowledgeByTarget.get(node.id) || []
      );
      if (knowledge.length) {
        payload.knowledge_bases = knowledge;
      }
    }

    return payload;
  });

  // Convert transitive edges set to backend format
  const backendEdges: BackendWorkflowEdgePayload[] = Array.from(transitiveEdges)
    .map((edgeKey) => {
      const [source, target] = edgeKey.split("->") as [string, string];
      return {
        source_node_id: source,
        target_node_id: target,
        label: `e-${source}-${target}`,
      };
    });

  // DEBUG: Log intermediate and output data
  console.log("[toBackendWorkflowPayload] keptNodes:", keptNodes.map(n => ({ id: n.id, type: n.data?.type })));
  console.log("[toBackendWorkflowPayload] transitiveEdges:", Array.from(transitiveEdges));
  console.log("[toBackendWorkflowPayload] OUTPUT backendNodes:", backendNodes);
  console.log("[toBackendWorkflowPayload] OUTPUT backendEdges:", backendEdges);

  return {
    name: (workflow.name || "Untitled Workflow").trim() || "Untitled Workflow",
    description: workflow.description?.trim() || "",
    nodes: backendNodes,
    edges: backendEdges,
  };
};

const toWorkflowMetadata = (
  workflow: BackendWorkflowListItem
): WorkflowMetadata => ({
  id: workflow.id,
  name: workflow.name,
  description: workflow.description || "",
  nodeCount: Number(workflow.nodes_count || 0),
  edgeCount: Number(workflow.edges_count || 0),
  createdAt: workflow.created_at,
  updatedAt: workflow.updated_at,
  isPublic: false,
  isActive: Boolean(workflow.is_active),
  runsCount: Number(workflow.runs_count || 0),
});

const toWorkflowDTO = (workflow: BackendWorkflowDetail): WorkflowDTO => {
  console.log("[toWorkflowDTO] Input workflow:", {
    id: workflow.id,
    name: workflow.name,
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    hasPreprocessedKb: !!workflow.preprocessed_knowledge,
  });

  // Build preprocessed knowledge lookup for context data
  const preprocessedKb = workflow.preprocessed_knowledge || {};

  // Collect all nodes (process nodes + recreated context nodes)
  const allNodes: WorkflowDTO["nodes"] = [];
  // Collect all edges (backend edges + edges from context nodes to process nodes)
  const allEdges: WorkflowDTO["edges"] = [];

  // Track created KB node IDs to avoid duplicates
  const createdKbNodes = new Map<string, string>(); // kb_id -> node_id

  workflow.nodes.forEach((node) => {
    // Determine frontend type
    let frontendType: FrontendNodeType = "model";
    if (node.node_type === "start") frontendType = "start";
    else if (node.node_type === "end") frontendType = "end";
    else if (node.persona_id) frontendType = "persona";
    else if (node.model_id) frontendType = "model";

    const label =
      frontendType === "start"
        ? "Start"
        : frontendType === "end"
        ? "End"
        : frontendType === "persona" && node.persona_name
        ? node.persona_name
        : frontendType === "model" && node.model_name
        ? node.model_name
        : node.node_id;

    // Create the main node (start/end/process)
    allNodes.push({
      id: node.node_id,
      type: "custom",
      position: {
        x: Number(node.position_x || 0),
        y: Number(node.position_y || 0),
      },
      data: {
        label,
        name: node.node_id,
        description: "",
        type: frontendType,
        status: "idle",
        config: {},
        instructions: node.instructions || "",
        selectedModel: node.model_id ? String(node.model_id) : undefined,
        modelId: node.model_id ? String(node.model_id) : undefined,
        selectedPersona: node.persona_id || undefined,
        modelData: node.model_name
          ? { name: node.model_name }
          : undefined,
        personaData: node.persona_name
          ? { name: node.persona_name }
          : undefined,
      },
    });

    // Recreate chat/pin context nodes from knowledge_bases
    const knowledgeBases = node.knowledge_bases || [];
    console.log(`[toWorkflowDTO] Node ${node.node_id} has ${knowledgeBases.length} knowledge_bases:`, knowledgeBases);

    knowledgeBases.forEach((kb, kbIndex) => {
      // Check if we already created a node for this kb_id
      if (createdKbNodes.has(kb.kb_id)) {
        // Just add an edge from existing node to this process node
        const existingNodeId = createdKbNodes.get(kb.kb_id)!;
        allEdges.push({
          id: `e-${existingNodeId}-${node.node_id}`,
          source: existingNodeId,
          target: node.node_id,
          type: "default",
        });
        return;
      }

      // Create a new context node for this KB
      const kbNodeId = `kb-${kb.kb_type}-${kb.kb_id}`;
      createdKbNodes.set(kb.kb_id, kbNodeId);

      // Get preprocessed context if available
      const preprocessed = preprocessedKb[kb.kb_id];
      const contextText = preprocessed?.context || "";

      if (kb.kb_type === "chat") {
        // Create chat node
        console.log(`[toWorkflowDTO] Creating CHAT node: ${kbNodeId} at (${kb.position_x}, ${kb.position_y})`);
        allNodes.push({
          id: kbNodeId,
          type: "custom",
          position: {
            x: Number(kb.position_x ?? node.position_x - 200),
            y: Number(kb.position_y ?? node.position_y + kbIndex * 120),
          },
          data: {
            label: "Chat",
            name: kbNodeId,
            description: contextText ? contextText.slice(0, 100) + "..." : "Chat context",
            type: "chat",
            status: "idle",
            config: {},
            instructions: kb.instruction || "",
            selectedChats: kb.kb_id,
          },
        });
      } else if (kb.kb_type === "pin") {
        // Create pin node
        console.log(`[toWorkflowDTO] Creating PIN node: ${kbNodeId} at (${kb.position_x}, ${kb.position_y})`);
        allNodes.push({
          id: kbNodeId,
          type: "custom",
          position: {
            x: Number(kb.position_x ?? node.position_x - 200),
            y: Number(kb.position_y ?? node.position_y + kbIndex * 120),
          },
          data: {
            label: "Pin",
            name: kbNodeId,
            description: contextText ? contextText.slice(0, 100) + "..." : "Pin context",
            type: "pin",
            status: "idle",
            config: {},
            instructions: kb.instruction || "",
            selectedPins: [kb.kb_id],
          },
        });
      }

      // Create edge from KB node to process node
      allEdges.push({
        id: `e-${kbNodeId}-${node.node_id}`,
        source: kbNodeId,
        target: node.node_id,
        type: "default",
      });
    });
  });

  // Add backend edges (between process nodes)
  workflow.edges.forEach((edge, index) => {
    allEdges.push({
      id: edge.id || `e-${edge.source_node_id}-${edge.target_node_id}-${String(index + 1)}`,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: "default",
    });
  });

  // Log final output
  console.log("[toWorkflowDTO] OUTPUT:", {
    totalNodes: allNodes.length,
    nodeTypes: allNodes.map(n => ({ id: n.id, type: n.data.type })),
    totalEdges: allEdges.length,
  });

  return {
    id: workflow.id,
    name: workflow.name || "Untitled Workflow",
    description: workflow.description || "",
    nodes: allNodes,
    edges: allEdges,
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at,
    isPublic: false,
    isActive: workflow.is_active,
    preprocessedKnowledge: workflow.preprocessed_knowledge,
  };
};

const toExecutionResult = (
  workflowId: string,
  result: BackendWorkflowExecutionResponse
): ExecutionResult => ({
  workflowId,
  executionId: result.run_id,
  runId: result.run_id,
  status: result.status,
  finalOutput: result.final_output,
  totalCost: result.total_cost,
  executionMetadata: result.execution_metadata,
  error: result.error,
});

const toExecutionSummary = (
  workflowId: string,
  run: BackendWorkflowRunSummary
): ExecutionResult => ({
  workflowId,
  executionId: run.run_id,
  runId: run.run_id,
  status: run.status,
  finalOutput: run.final_output,
  executionMetadata: run.execution_metadata,
  startTime: run.started_at,
  endTime: run.completed_at || undefined,
  error: run.error_message || undefined,
});

export const workflowAPI = {
  list: async (): Promise<{ workflows: WorkflowMetadata[]; total: number }> => {
    const response = await fetchWithTimeout(WORKFLOWS_ENDPOINT, {
      method: "GET",
    });
    const data = await handleResponse<BackendWorkflowListItem[]>(response);
    const workflows = Array.isArray(data) ? data.map(toWorkflowMetadata) : [];
    return {
      workflows,
      total: workflows.length,
    };
  },

  get: async (id: string): Promise<WorkflowDTO> => {
    const response = await fetchWithTimeout(workflowDetailEndpoint(id), {
      method: "GET",
    });
    const data = await handleResponse<BackendWorkflowDetail>(response);
    return toWorkflowDTO(data);
  },

  create: async (
    workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowDTO> => {
    const payload = toBackendWorkflowPayload(workflow);
    console.log("[workflowAPI] Sending workflow graph payload (create):", payload);
    const response = await fetchWithTimeout(WORKFLOWS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const created = await handleResponse<BackendWorkflowCreateResponse>(response);
    return {
      ...workflow,
      id: created.id,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  },

  upsert: async (
    id: string | null,
    workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowDTO> => {
    const createOrReuseExistingWorkflow = async (): Promise<WorkflowDTO> => {
      try {
        return await workflowAPI.create(workflow);
      } catch (createError) {
        const isDuplicateNameError =
          createError instanceof WorkflowAPIError &&
          [400, 409].includes(createError.status ?? 0) &&
          /workflow_user_id_name|duplicate key value|already exists/i.test(
            createError.message
          );

        if (!isDuplicateNameError) {
          throw createError;
        }

        const normalizedName = workflow.name.trim().toLowerCase();
        if (!normalizedName) {
          throw createError;
        }

        try {
          const { workflows } = await workflowAPI.list();
          const existingWorkflow = workflows.find(
            (item) => item.name.trim().toLowerCase() === normalizedName
          );

          if (!existingWorkflow) {
            throw createError;
          }

          return {
            ...workflow,
            id: existingWorkflow.id,
            createdAt: existingWorkflow.createdAt,
            updatedAt: existingWorkflow.updatedAt,
          };
        } catch {
          throw createError;
        }
      }
    };

    if (id && isUuid(id)) {
      const payload = toBackendWorkflowPayload(workflow);
      console.log("[workflowAPI] Sending workflow graph payload (update):", {
        workflowId: id,
        payload,
      });
      const patchResponse = await fetchWithTimeout(workflowDetailEndpoint(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (patchResponse.ok) {
        const updated = await handleResponse<
          BackendWorkflowDetail | BackendWorkflowCreateResponse
        >(patchResponse);
        if ("nodes" in (updated as BackendWorkflowDetail)) {
          return toWorkflowDTO(updated as BackendWorkflowDetail);
        }
        return {
          ...workflow,
          id: (updated as BackendWorkflowCreateResponse).id || id,
          createdAt: (updated as BackendWorkflowCreateResponse).created_at,
          updatedAt: (updated as BackendWorkflowCreateResponse).updated_at,
        };
      }

      if (patchResponse.status === 404) {
        return createOrReuseExistingWorkflow();
      }

      if ([405, 501].includes(patchResponse.status)) {
        throw new WorkflowAPIError(
          "Backend workflow update endpoint is not available yet.",
          patchResponse.status,
          "UNSUPPORTED_UPDATE"
        );
      }

      await handleResponse(patchResponse);
    }

    return createOrReuseExistingWorkflow();
  },

  update: async (id: string, workflow: Partial<WorkflowDTO>): Promise<WorkflowDTO> => {
    if (!workflow.name || !workflow.nodes || !workflow.edges) {
      throw new WorkflowAPIError(
        "Workflow update requires full payload (name, nodes, edges).",
        400,
        "INVALID_PAYLOAD"
      );
    }

    return workflowAPI.upsert(id, {
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      edges: workflow.edges,
      viewport: workflow.viewport,
      version: workflow.version,
      tags: workflow.tags,
      isPublic: workflow.isPublic,
    });
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetchWithTimeout(workflowDetailEndpoint(id), {
      method: "DELETE",
    });

    if (response.ok) return;
    if ([404, 405, 501].includes(response.status)) {
      throw new WorkflowAPIError(
        "Delete workflow is not supported by backend yet.",
        response.status,
        "UNSUPPORTED"
      );
    }
    await handleResponse(response);
  },

  execute: async (
    id: string,
    options?: {
      inputText?: string;
      input_text?: string;
    }
  ): Promise<ExecutionResult> => {
    const inputText = (
      options?.input_text ||
      options?.inputText ||
      ""
    ).trim();

    if (!inputText) {
      throw new WorkflowAPIError(
        "input_text is required to execute a workflow.",
        400,
        "INVALID_INPUT"
      );
    }

    const response = await fetchWithTimeout(
      workflowExecuteEndpoint(id),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input_text: inputText }),
      },
      60000
    );

    const data = await handleResponse<BackendWorkflowExecutionResponse>(response);
    return toExecutionResult(id, data);
  },

  getExecutions: async (
    id: string
  ): Promise<{ executions: ExecutionResult[]; total: number }> => {
    const response = await fetchWithTimeout(workflowRunsEndpoint(id), {
      method: "GET",
    });
    const data = await handleResponse<BackendWorkflowRunSummary[]>(response);
    const executions = Array.isArray(data)
      ? data.map((run) => toExecutionSummary(id, run))
      : [];

    return {
      executions,
      total: executions.length,
    };
  },

  share: async (
    _id: string,
    _options: { isPublic: boolean }
  ): Promise<{ shareUrl: string }> => {
    void _id;
    void _options;
    throw new WorkflowAPIError(
      "Share workflow is not supported by backend yet.",
      501,
      "UNSUPPORTED"
    );
  },

  uploadFile: async (file: File): Promise<{ fileId: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/files/upload`,
      {
        method: "POST",
        body: formData,
      },
      120000
    );

    return handleResponse(response);
  },

  fetchChats: async (): Promise<
    Array<{ id: string; name: string; pinnedDate?: string }>
  > => {
    try {
      const response = await apiFetch("/chats/", { method: "GET" });
      if (!response.ok) return [];

      const rawData = await response.json();
      const chatList = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.results)
        ? rawData.results
        : Array.isArray(rawData?.chats)
        ? rawData.chats
        : [];

      return chatList
        .map((chat: Record<string, unknown>) => ({
          id: String(chat.id || chat.chatId || ""),
          name: chat.name || chat.title || `Chat ${chat.id || ""}`,
          pinnedDate:
            chat.pinnedDate || chat.createdAt || chat.updated_at || undefined,
        }))
        .filter((chat: { id: string }) => Boolean(chat.id));
    } catch {
      return [];
    }
  },

  fetchModels: async (): Promise<
    Array<{
      id: string;
      modelId: string;
      name: string;
      companyName: string;
      description?: string;
      logo?: string;
      modelType?: "free" | "paid";
      sdkLibrary?: string;
      inputModalities?: string[];
      outputModalities?: string[];
      inputLimit?: number;
      outputLimit?: number;
    }>
  > => {
    try {
      const response = await fetchWithTimeout(MODELS_ENDPOINT, { method: "GET" });
      if (!response.ok) return [];

      const rawData = await response.json();
      const modelList = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.results)
        ? rawData.results
        : Array.isArray(rawData?.models)
        ? rawData.models
        : [];

      return modelList
        .map((model: Record<string, unknown>) => {
          const id = String(model.id || model.modelId || "");
          const modelTypeRaw = String(
            model.modelType || model.model_plan_type || model.planType || ""
          ).toLowerCase();

          return {
            id,
            modelId: String(model.modelId || model.id || ""),
            name: model.modelName || model.name || "Unknown Model",
            companyName:
              model.companyName || model.providerName || model.provider || "Unknown",
            description: model.description || "",
            logo: model.logo || "",
            modelType: modelTypeRaw.includes("free") ? "free" : "paid",
            sdkLibrary: model.sdkLibrary || "",
            inputModalities: model.inputModalities || [],
            outputModalities: model.outputModalities || [],
            inputLimit:
              typeof model.inputLimit === "number"
                ? model.inputLimit
                : typeof model.input_token_limit === "number"
                ? model.input_token_limit
                : 0,
            outputLimit:
              typeof model.outputLimit === "number"
                ? model.outputLimit
                : typeof model.output_token_limit === "number"
                ? model.output_token_limit
                : 0,
          };
        })
        .filter((model: { id: string }) => Boolean(model.id));
    } catch {
      return [];
    }
  },

  fetchPersonas: async (): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      image?: string;
      modelId?: string;
    }>
  > => {
    try {
      const response = await fetchWithTimeout(PERSONAS_ENDPOINT, {
        method: "GET",
      });
      if (!response.ok) return [];

      const rawData = await response.json();
      const personaList = Array.isArray(rawData) ? rawData : [];

      return personaList
        .map((persona: Record<string, unknown>) => ({
          id: String(persona.id || ""),
          name: persona.name || "Untitled Persona",
          description: persona.prompt?.slice(0, 140) || "",
          modelId: persona.modelId ? String(persona.modelId) : undefined,
          image: persona.imageUrl
            ? persona.imageUrl.startsWith("http") ||
              persona.imageUrl.startsWith("data:") ||
              persona.imageUrl.startsWith("blob:")
              ? persona.imageUrl
              : `${API_BASE_URL}${persona.imageUrl.startsWith("/") ? "" : "/"}${
                  persona.imageUrl
                }`
            : undefined,
        }))
        .filter((persona: { id: string }) => Boolean(persona.id));
    } catch {
      return [];
    }
  },

  fetchPins: async (): Promise<
    Array<{
      id: string;
      name: string;
      title?: string;
      text?: string;
      content?: string;
      tags?: string[];
      folderId?: string;
      folderName?: string;
      chatId?: string;
      created_at?: string;
      pinnedDate?: string;
    }>
  > => {
    try {
      const response = await fetchWithTimeout(PINS_ENDPOINT, { method: "GET" });
      if (!response.ok) return [];

      const rawData = await response.json();
      const pinList = Array.isArray(rawData) ? rawData : [];

      return pinList
        .map((pin: Record<string, unknown>) => ({
          id: String(pin.id || ""),
          name: pin.title || pin.content || "Untitled Pin",
          title: pin.title || pin.content || "Untitled Pin",
          text: pin.content || pin.title || "",
          content: pin.content || "",
          tags: pin.tags || [],
          folderId: pin.folderId || pin.folder_id || undefined,
          folderName: pin.folderName || undefined,
          chatId: pin.chat || pin.sourceChatId || undefined,
          created_at: pin.created_at || undefined,
          pinnedDate: pin.created_at || undefined,
        }))
        .filter((pin: { id: string }) => Boolean(pin.id));
    } catch {
      return [];
    }
  },
};

export { WorkflowAPIError };
