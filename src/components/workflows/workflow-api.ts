import { WorkflowDTO, WorkflowMetadata, ExecutionResult } from "./types";
import {
  API_BASE_URL,
  MODELS_ENDPOINT,
  PERSONAS_ENDPOINT,
  PINS_ENDPOINT,
  PIN_FOLDERS_ENDPOINT,
  CHATS_ENDPOINT,
  WORKFLOWS_ENDPOINT,
  WORKFLOW_DETAIL_ENDPOINT,
  WORKFLOW_CHATS_ENDPOINT,
  WORKFLOW_CHATS_CREATE_ENDPOINT,
  WORKFLOW_CHAT_MESSAGES_ENDPOINT,
  WORKFLOW_CHAT_STREAM_ENDPOINT,
  WORKFLOW_CHAT_STOP_ENDPOINT,
  WORKFLOW_CHATS_RENAME_ENDPOINT,
  WORKFLOW_CHAT_DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import { apiFetch } from "@/lib/api/client";

type FrontendNodeType =
  | "start"
  | "end"
  | "document"
  | "chat"
  | "pin"
  | "persona"
  | "model"
  | "phantom";

type BackendNodeType = "start" | "end" | "document" | "model" | "persona" | "chat" | "pin_folder" | "pin";

// =============================================================================
// BACKEND API TYPES (Request / Response shapes)
// =============================================================================

interface BackendWorkflowNodePayload {
  node_id: string;
  name: string;
  node_type: BackendNodeType;
  reference_id?: string;
  documents?: string[];
  instructions: string;
  position_x: number;
  position_y: number;
}

interface BackendWorkflowEdgePayload {
  source: string;
  target: string;
  label?: string;
}

interface BackendWorkflowCreatePayload {
  name: string;
  description?: string;
  is_active?: boolean;
  thumbnail?: string;
  nodes: BackendWorkflowNodePayload[];
  edges: BackendWorkflowEdgePayload[];
}

interface BackendWorkflowListItem {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  document_filename: string | null;
  total_usage: number;
  nodes_count: number;
  edges_count: number;
  chats_count: number;
  created_at: string;
  updated_at: string;
}

interface BackendWorkflowNode {
  id?: string;
  node_id: string;
  name: string;
  node_type: BackendNodeType;
  reference_id: string;
  documents?: string[];
  instructions: string;
  position_x: number;
  position_y: number;
  created_at?: string;
  updated_at?: string;
}

interface BackendWorkflowEdge {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
  created_at?: string;
}

interface BackendWorkflowDetail {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  thumbnail?: string;
  document_filename?: string | null;
  total_usage?: number;
  created_at?: string;
  updated_at?: string;
  nodes: BackendWorkflowNode[];
  edges: BackendWorkflowEdge[];
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

// =============================================================================
// STREAMING EXECUTION TYPES
// =============================================================================

export type StreamEventType =
  // Current backend API event types
  | "workflow_start"
  | "node_start"
  | "content"
  | "node_complete"
  | "workflow_complete"
  | "node_failed"
  | "error"
  // Legacy / fallback event types
  | "metadata"
  | "start"
  | "node_success"
  | "end"
  | "done"
  | "chunk"
  | "node_end"
  | "ask_user";

export interface StreamEventBase {
  event: StreamEventType;
  run_id?: string;
  timestamp?: string;
}

export interface WorkflowStartEvent extends StreamEventBase {
  event: "workflow_start";
  workflow_id?: string;
  workflow_name?: string;
  node_count?: number;
  // legacy fields
  run_id?: string;
  input_text?: string;
}

export interface NodeStartEvent extends StreamEventBase {
  event: "node_start";
  node_id: string;
  node_type: string;
  /** Normalized from the "name" field in new API or "node_name" in legacy API */
  node_name?: string;
  name?: string;
  execution_order?: number;
  started_at?: string;
}

export interface ChunkEvent extends StreamEventBase {
  event: "chunk";
  node_id: string;
  /** Normalized content — populated from "delta" (new API) or "content" (legacy API) */
  content: string;
  delta?: string;
  chunk_index?: number;
}

export interface NodeEndEvent extends StreamEventBase {
  event: "node_end";
  node_id: string;
  output: string;
  tokens_used?: number;
  cost?: number;
  duration_ms?: number;
}

export interface NodeCompleteEvent extends StreamEventBase {
  event: "node_complete";
  node_id: string;
  node_type: string;
  name?: string;
  output?: string;
}

export interface WorkflowCompleteEvent extends StreamEventBase {
  event: "workflow_complete";
  final_output: string;
  // legacy fields
  run_id?: string;
  images?: Array<{ url: string; alt?: string }>;
  total_cost?: number;
  total_tokens?: number;
  total_duration_ms?: number;
}

export interface AskUserSuggestion {
  label: string;
  description?: string;
}

export interface AskUserEvent extends StreamEventBase {
  event: "ask_user";
  question: string;
  suggestions?: AskUserSuggestion[];
}

export interface StreamErrorEvent extends StreamEventBase {
  event: "error";
  node_id?: string;
  error: string;
  error_code?: string;
}

export type StreamEvent =
  | WorkflowStartEvent
  | NodeStartEvent
  | ChunkEvent
  | NodeEndEvent
  | NodeCompleteEvent
  | WorkflowCompleteEvent
  | AskUserEvent
  | StreamErrorEvent;

export interface StreamCallbacks {
  onWorkflowStart?: (event: WorkflowStartEvent) => void;
  onNodeStart?: (event: NodeStartEvent) => void;
  onChunk?: (event: ChunkEvent) => void;
  onNodeEnd?: (event: NodeEndEvent) => void;
  onNodeComplete?: (event: NodeCompleteEvent) => void;
  onWorkflowComplete?: (event: WorkflowCompleteEvent) => void;
  onAskUser?: (event: AskUserEvent) => void;
  onError?: (event: StreamErrorEvent) => void;
}

// Chat session returned by GET /workflow/{id}/chats
export interface WorkflowChatSession {
  id: string;        // maps from chat_id
  title: string;     // maps from chat_title
  message_count?: number;
}

// Message returned by GET /workflow/{id}/chats/{chat_id}/messages
export interface WorkflowChatMessage {
  message_id: string;
  input: string;
  output: string;
  reasoning?: string;
}

const STREAM_EVENT_TYPES = new Set<StreamEventType>([
  "workflow_start",
  "node_start",
  "content",
  "node_complete",
  "workflow_complete",
  "node_failed",
  "error",
  "metadata",
  "start",
  "chunk",
  "node_success",
  "end",
  "done",
  "node_end",
  "ask_user",
]);

const toStreamEventType = (value: unknown): StreamEventType | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return STREAM_EVENT_TYPES.has(normalized as StreamEventType)
    ? (normalized as StreamEventType)
    : undefined;
};

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
    // Log full body so validation errors (e.g. Django field errors) are visible in console
    if (process.env.NODE_ENV === "development") {
      console.error(`[WorkflowAPI] ${response.status} ${response.url}`, errorPayload);
    }
    const message =
      errorPayload?.message ||
      errorPayload?.detail ||
      errorPayload?.error ||
      (typeof errorPayload === "object" && errorPayload !== null
        ? JSON.stringify(errorPayload)
        : undefined) ||
      response.statusText ||
      "API request failed";
    throw new WorkflowAPIError(
      typeof message === "string" ? message : JSON.stringify(message),
      response.status,
      typeof errorPayload?.code === "string" ? errorPayload.code : undefined
    );
  }

  const payload = await parseJsonSafe(response);
  return payload as T;
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
    if (process.env.NODE_ENV === "development" && method !== "GET") {
      try {
        console.debug(`[WorkflowAPI] ${method} ${url}`, JSON.parse(options.body as string));
      } catch {
        console.debug(`[WorkflowAPI] ${method} ${url}`, options.body);
      }
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


// =============================================================================
// NODE TYPE MAPPING
// =============================================================================

/** Node types that have no backend equivalent — excluded from the payload */
const UNSUPPORTED_FRONTEND_TYPES = new Set<string>(["phantom"]);

const toBackendNodeType = (frontendType: string): BackendNodeType | null => {
  switch (frontendType) {
    case "start":   return "start";
    case "end":     return "end";
    case "document": return "document";
    case "model":   return "model";
    case "persona": return "persona";
    case "chat":    return "chat";
    case "pin":     return "pin_folder";
    default:        return null;
  }
};

const fromBackendNodeType = (backendType: string): FrontendNodeType => {
  switch (backendType) {
    case "start":      return "start";
    case "end":        return "end";
    case "document":   return "document";
    case "model":      return "model";
    case "persona":    return "persona";
    case "chat":       return "chat";
    case "pin_folder": return "pin";
    case "pin":        return "pin";
    default:           return "model";
  }
};

/** Extract the single reference_id for a node from its frontend data */
const getNodeReferenceId = (node: WorkflowDTO["nodes"][0]): string => {
  const type = (node.data?.type ?? "") as FrontendNodeType;
  switch (type) {
    case "document":
      return "";
    case "chat":
      return asString(node.data?.selectedChats) || "";
    case "pin":
      // Prefer folder UUID; fall back to first pin ID if folder not set
      return (
        asString(node.data?.selectedFolder?.id) ||
        (Array.isArray(node.data?.selectedPins)
          ? asString(node.data!.selectedPins![0])
          : "") ||
        ""
      );
    case "persona":
      return asString(node.data?.selectedPersona) || "";
    case "model":
      return asString(node.data?.selectedModel || node.data?.modelId) || "";
    default:
      return "";
  }
};

// =============================================================================
// PAYLOAD TRANSFORMERS
// =============================================================================

/**
 * Convert a frontend WorkflowDTO into the backend create/update payload.
 *
 * All supported node types are sent directly with a `reference_id` field.
 * Document and phantom nodes are excluded as they have no backend representation.
 * Edges are filtered to only include connections between backend-supported nodes.
 */
const toBackendWorkflowPayload = (
  workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt"> | WorkflowDTO
): BackendWorkflowCreatePayload => {
  const backendNodes: BackendWorkflowNodePayload[] = [];

  for (const node of workflow.nodes) {
    const frontendType = (node.data?.type ?? "") as FrontendNodeType;

    if (UNSUPPORTED_FRONTEND_TYPES.has(frontendType)) continue;

    let backendNodeType = toBackendNodeType(frontendType);
    if (!backendNodeType) continue;

    let refId = getNodeReferenceId(node);

    // For pin nodes, determine correct backend type based on available reference:
    // - selectedFolder.id present → pin_folder (fetches all pins in folder)
    // - only selectedPins[0] present → pin (single pin UUID)
    if (frontendType === "pin") {
      const hasFolderRef = Boolean(node.data?.selectedFolder?.id);
      backendNodeType = hasFolderRef ? "pin_folder" : "pin";
    }

    const nodePayload: BackendWorkflowNodePayload = {
      node_id: node.id,
      name: asString(node.data?.label) || asString(node.data?.name) || node.id || "Node",
      node_type: backendNodeType,
      instructions:
        asString(node.data?.instructions) ||
        asString(node.data?.prompt) ||
        asString(node.data?.systemPrompt) ||
        "",
      position_x: Number(node.position?.x ?? 0),
      position_y: Number(node.position?.y ?? 0),
    };

    // Only include reference_id when non-empty (start/end nodes must not have it)
    if (refId) nodePayload.reference_id = refId;

    backendNodes.push(nodePayload);
  }

  // Only send edges whose both endpoints are included in the payload
  const backendNodeIds = new Set(backendNodes.map((n) => n.node_id));
  const backendEdges: BackendWorkflowEdgePayload[] = workflow.edges
    .filter(
      (edge) =>
        backendNodeIds.has(edge.source) && backendNodeIds.has(edge.target)
    )
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));

  const payload: BackendWorkflowCreatePayload = {
    name: (workflow.name || "Untitled Workflow").trim() || "Untitled Workflow",
    description: workflow.description?.trim() || "",
    nodes: backendNodes,
    edges: backendEdges,
  };

  if ("isActive" in workflow && workflow.isActive !== undefined) {
    payload.is_active = workflow.isActive;
  }

  if ("thumbnail" in workflow && workflow.thumbnail) {
    payload.thumbnail = workflow.thumbnail;
  }

  return payload;
};

const toWorkflowMetadata = (
  workflow: BackendWorkflowListItem
): WorkflowMetadata => {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || "",
    nodeCount: Number(workflow.nodes_count || 0),
    edgeCount: Number(workflow.edges_count || 0),
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at,
    isPublic: false,
    isActive: workflow.is_active !== undefined ? workflow.is_active : true,
    runsCount: Number(workflow.chats_count || 0),
  };
};

const ensureDocumentFilesUploaded = async (
  workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt"> | WorkflowDTO,
  uploadFn: (file: File) => Promise<{ fileId: string; url: string }>
): Promise<typeof workflow> => {
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    return workflow;
  }

  let changed = false;

  const nodes = await Promise.all(
    workflow.nodes.map(async (node) => {
      const nodeType = (node.data?.type ?? "") as FrontendNodeType;
      if (nodeType !== "document") return node;

      const files = Array.isArray(node.data?.files) ? node.data?.files : [];
      if (files.length === 0) return node;

      let filesChanged = false;

      const nextFiles = await Promise.all(
        files.map(async (file) => {
          const typedFile = file as {
            fileId?: string;
            file?: File;
            url?: string;
            isUploading?: boolean;
            uploadProgress?: number;
          };

          if (typedFile.fileId || !typedFile.file) return file;

          try {
            const result = await uploadFn(typedFile.file);
            filesChanged = true;
            return {
              ...file,
              fileId: result.fileId,
              url: result.url || typedFile.url,
              isUploading: false,
              uploadProgress: 100,
            };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unable to upload file.";
            throw new WorkflowAPIError(message, 400, "DOCUMENT_UPLOAD_FAILED");
          }
        })
      );

      if (!filesChanged) return node;
      changed = true;

      return {
        ...node,
        data: {
          ...node.data,
          files: nextFiles,
        },
      };
    })
  );

  if (!changed) return workflow;

  return {
    ...workflow,
    nodes,
  };
};

/**
 * Convert a backend workflow detail response into the frontend WorkflowDTO.
 *
 * Each backend node maps 1:1 to a frontend node — no KB node reconstruction needed.
 */
const toWorkflowDTO = (workflow: BackendWorkflowDetail): WorkflowDTO => {
  const allNodes: WorkflowDTO["nodes"] = workflow.nodes.map((node) => {
    const frontendType = fromBackendNodeType(node.node_type);
    const label = node.name || node.node_id;

    const data: WorkflowDTO["nodes"][0]["data"] = {
      label,
      name: label,
      description: "",
      type: frontendType,
      status: "idle",
      config: {},
      instructions: node.instructions || "",
    };

    // Populate type-specific reference fields
    switch (frontendType) {
      case "document":
        if (Array.isArray(node.documents) && node.documents.length > 0) {
          data.files = node.documents.map((fileId) => ({
            id: fileId,
            name: fileId,
            size: 0,
            type: "document",
            fileId,
          }));
        } else if (workflow.document_filename) {
          const fileId =
            typeof node.reference_id === "string" && node.reference_id.trim().length > 0
              ? node.reference_id.trim()
              : workflow.id;
          data.files = [
            {
              id: fileId,
              name: workflow.document_filename,
              size: 0,
              type: "document",
              fileId,
            },
          ];
        }
        break;
      case "chat":
        if (node.reference_id) {
          data.selectedChats = node.reference_id;
          data.chatData = { name: node.name || node.reference_id, id: node.reference_id };
        }
        break;
      case "pin":
        if (node.reference_id) {
          if (node.node_type === "pin_folder") {
            // Reference is a folder UUID — restore as selectedFolder
            data.selectedFolder = {
              id: node.reference_id,
              name: node.name || node.reference_id,
              pinIds: [],
            };
            data.selectedPins = [];
          } else {
            // node_type === "pin" — reference is a single pin UUID
            data.selectedPins = [node.reference_id];
          }
        }
        break;
      case "persona":
        if (node.reference_id) {
          data.selectedPersona = node.reference_id;
          data.personaData = { name: node.name || node.reference_id };
        }
        break;
      case "model":
        if (node.reference_id) {
          data.selectedModel = node.reference_id;
          data.modelId = node.reference_id;
          data.modelData = { name: node.name || node.reference_id };
        }
        break;
    }

    return {
      id: node.node_id,
      type: "custom",
      position: {
        x: Number(node.position_x ?? 0),
        y: Number(node.position_y ?? 0),
      },
      data,
    };
  });

  // Build a map from node DB UUID → node_id (React Flow node id)
  const nodeUuidToNodeId = new Map<string, string>(
    workflow.nodes
      .filter((n) => n.id && n.node_id)
      .map((n) => [n.id!, n.node_id])
  );

  const allEdges: WorkflowDTO["edges"] = workflow.edges.map((edge, index) => {
    const source = nodeUuidToNodeId.get(edge.source_node_id) ?? edge.source_node_id;
    const target = nodeUuidToNodeId.get(edge.target_node_id) ?? edge.target_node_id;
    return {
      id: edge.id || `e-${source}-${target}-${String(index + 1)}`,
      source,
      target,
      type: "default",
    };
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
    isActive: workflow.is_active !== undefined ? workflow.is_active : true,
    thumbnail: workflow.thumbnail,
    documentFilename: workflow.document_filename ?? undefined,
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

interface WorkflowRequestPreparation {
  workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">;
  body: FormData;
  headers?: HeadersInit;
}

const extractDocumentFile = (
  workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">
): File | null => {
  for (const node of workflow.nodes) {
    const nodeType = (node.data?.type ?? "") as FrontendNodeType;
    if (nodeType !== "document") continue;

    const files = Array.isArray(node.data?.files) ? node.data.files : [];
    for (const file of files) {
      const typedFile = file as { file?: File };
      if (typedFile.file instanceof File) {
        return typedFile.file;
      }
    }
  }

  return null;
};

const prepareWorkflowRequest = async (
  workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">
): Promise<WorkflowRequestPreparation> => {

  const normalizedWorkflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt"> = {
    ...workflow,
    nodes: await Promise.all(workflow.nodes.map(async (node) => {
      const nodeType = (node.data?.type ?? "") as FrontendNodeType;
      if (nodeType !== "document") return node;

      const files = Array.isArray(node.data?.files) ? node.data.files : [];
      if (files.length === 0) return node;

      const normalizedFiles = files.map((file) => {
        const typedFile = file as {
          fileId?: string;
          file?: File;
        };

        if (typedFile.fileId || !typedFile.file) return file;

        // Keep an explicit placeholder so backend can resolve the actual upload by workflow id.
        return {
          ...file,
          fileId: "uploaded_document",
        };
      });

      return {
        ...node,
        data: {
          ...node.data,
          files: normalizedFiles,
        },
      };
    })),
  };

  const payload = toBackendWorkflowPayload(normalizedWorkflow);
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));

  const file = extractDocumentFile(workflow);
  if (file) {
    formData.append("file", file);
  }

  return {
    workflow: normalizedWorkflow,
    body: formData,
    headers: undefined,
  };
};

// =============================================================================
// SSE STREAM HELPERS
// =============================================================================

/**
 * Read an SSE stream from a Response and dispatch to StreamCallbacks.
 * Handles both the new API event types (metadata/start/node_success/done/node_failed)
 * and the legacy types (workflow_start/node_end/node_complete/workflow_complete/ask_user).
 */
const processSseStream = async (
  response: Response,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> => {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.({
      event: "error",
      error: "No response body",
      error_code: "NO_BODY",
    });
    return;
  }

  try {
    const decoder = new TextDecoder();
    let buffer = "";
    let pendingEventType: StreamEventType | undefined;

    const processSseLine = (line: string) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        pendingEventType = undefined;
        return;
      }
      if (trimmedLine.startsWith(":")) return;

      if (trimmedLine.startsWith("event:")) {
        pendingEventType = toStreamEventType(trimmedLine.slice(6));
        return;
      }

      if (!trimmedLine.startsWith("data:")) return;

      const jsonStr = trimmedLine.slice(5).trim();
      if (!jsonStr) return;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        console.warn("[SSE] Failed to parse event JSON:", jsonStr.slice(0, 100));
        return;
      }

      const eventType =
        toStreamEventType(event.event) ??
        toStreamEventType(event.type) ??
        pendingEventType;
      pendingEventType = undefined;

      if (!eventType) return;

      console.debug("[SSE] Event:", eventType);

      switch (eventType) {
        // ── New API events ───────────────────────────────────────────────────

        // ── workflow_start (current API) ─────────────────────────────────
        case "workflow_start":
          callbacks.onWorkflowStart?.({
            event: "workflow_start",
            workflow_id: typeof event.workflow_id === "string" ? event.workflow_id : undefined,
            workflow_name: typeof event.workflow_name === "string" ? event.workflow_name : undefined,
            node_count: typeof event.node_count === "number" ? event.node_count : undefined,
          });
          break;

        // ── Legacy: metadata → onWorkflowStart ──────────────────────────
        case "metadata":
          callbacks.onWorkflowStart?.({
            event: "workflow_start",
            run_id: typeof event.run_id === "string" ? event.run_id : undefined,
            workflow_id: typeof event.workflow_id === "string" ? event.workflow_id : undefined,
          });
          break;

        case "start":
          break;

        case "node_start": {
          // Normalize "name" (new API) → "node_name" (legacy callback field)
          const adapted: NodeStartEvent = {
            event: "node_start",
            node_id: String(event.node_id ?? ""),
            node_type: String(event.node_type ?? ""),
            node_name:
              String(event.node_name ?? event.name ?? event.node_id ?? ""),
            name: String(event.name ?? ""),
            execution_order:
              typeof event.execution_order === "number"
                ? event.execution_order
                : undefined,
            started_at:
              typeof event.started_at === "string" ? event.started_at : undefined,
          };
          callbacks.onNodeStart?.(adapted);
          break;
        }

        // ── content (current API) / chunk (legacy) ───────────────────────
        case "content":
        case "chunk": {
          const adapted: ChunkEvent = {
            event: "chunk",
            node_id: String(event.node_id ?? ""),
            content: String(event.content ?? event.delta ?? ""),
            delta: typeof event.delta === "string" ? event.delta : undefined,
            chunk_index:
              typeof event.chunk_index === "number" ? event.chunk_index : undefined,
          };
          callbacks.onChunk?.(adapted);
          break;
        }

        // ── node_complete (current API) ──────────────────────────────────
        case "node_complete":
          callbacks.onNodeComplete?.({
            event: "node_complete",
            node_id: String(event.node_id ?? ""),
            node_type: String(event.node_type ?? ""),
            name: typeof event.name === "string" ? event.name : undefined,
            output: typeof event.output === "string" ? event.output : undefined,
          });
          break;

        // ── workflow_complete (current API) ──────────────────────────────
        case "workflow_complete":
          callbacks.onWorkflowComplete?.({
            event: "workflow_complete",
            final_output: String(event.final_output ?? event.response ?? ""),
            run_id: typeof event.run_id === "string" ? event.run_id : undefined,
            total_cost: typeof event.total_cost === "number" ? event.total_cost : undefined,
          });
          break;

        // ── node_failed ──────────────────────────────────────────────────
        case "node_failed":
          callbacks.onError?.({
            event: "error",
            node_id: typeof event.node_id === "string" ? event.node_id : undefined,
            error: String(event.error ?? "Node execution failed"),
          });
          break;

        // ── Legacy: node_success → onNodeEnd + onNodeComplete ────────────
        case "node_success": {
          const nodeId = String(event.node_id ?? "");
          const tokensIn = typeof event.tokens_input === "number" ? event.tokens_input : 0;
          const tokensOut = typeof event.tokens_output === "number" ? event.tokens_output : 0;
          callbacks.onNodeEnd?.({
            event: "node_end",
            node_id: nodeId,
            output: String(event.output ?? ""),
            tokens_used: tokensIn + tokensOut,
            cost: typeof event.cost === "number" ? event.cost : undefined,
          });
          callbacks.onNodeComplete?.({
            event: "node_complete",
            node_id: nodeId,
            node_type: String(event.node_type ?? ""),
            output: String(event.output ?? ""),
          });
          break;
        }

        // ── Legacy: done → onWorkflowComplete ───────────────────────────
        case "done": {
          const tokensIn = typeof event.tokens_input === "number" ? event.tokens_input : 0;
          const tokensOut = typeof event.tokens_output === "number" ? event.tokens_output : 0;
          const doneImages = Array.isArray(event.images)
            ? (event.images as Array<{ url: string; alt?: string }>).filter((img) => img?.url)
            : undefined;
          callbacks.onWorkflowComplete?.({
            event: "workflow_complete",
            run_id: String(event.run_id ?? ""),
            final_output: String(event.response ?? event.final_output ?? ""),
            ...(doneImages?.length ? { images: doneImages } : {}),
            total_cost: typeof event.total_cost === "number" ? event.total_cost : undefined,
            total_tokens: tokensIn + tokensOut,
          });
          break;
        }

        case "node_end":
          callbacks.onNodeEnd?.(event as unknown as NodeEndEvent);
          break;

        case "end":
          break;

        case "ask_user":
          callbacks.onAskUser?.(event as unknown as AskUserEvent);
          break;

        case "error":
          callbacks.onError?.({
            event: "error",
            node_id: typeof event.node_id === "string" ? event.node_id : undefined,
            error: String(event.error ?? "Unknown error"),
            error_code: typeof event.error_code === "string" ? event.error_code : undefined,
          });
          break;
      }
    };

    while (true) {
      if (signal.aborted) break;

      const { done, value } = await reader.read();

      if (done) {
        const trailing = decoder.decode();
        if (trailing) buffer += trailing;
        if (buffer && !buffer.endsWith("\n")) buffer += "\n";
      } else {
        buffer += decoder.decode(value, { stream: true });
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processSseLine(line);
      }

      if (done) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
};

// =============================================================================
// PUBLIC API
// =============================================================================

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
    const response = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
      method: "GET",
    });
    const data = await handleResponse<BackendWorkflowDetail>(response);
    return toWorkflowDTO(data);
  },

  create: async (
    workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowDTO> => {
    const prepared = await prepareWorkflowRequest(workflow);
    const response = await fetchWithTimeout(WORKFLOWS_ENDPOINT, {
      method: "POST",
      headers: prepared.headers,
      body: prepared.body,
    });

    const created = await handleResponse<
      BackendWorkflowDetail | BackendWorkflowCreateResponse
    >(response);

    if ("nodes" in (created as BackendWorkflowDetail)) {
      return toWorkflowDTO(created as BackendWorkflowDetail);
    }

    return {
      ...workflow,
      id: (created as BackendWorkflowCreateResponse).id,
      createdAt: (created as BackendWorkflowCreateResponse).created_at,
      updatedAt: (created as BackendWorkflowCreateResponse).updated_at,
    };
  },

  upsert: async (
    id: string | null,
    workflow: Omit<WorkflowDTO, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowDTO> => {
    const prepared = await prepareWorkflowRequest(workflow);
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
      const putResponse = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
        method: "PUT",
        headers: prepared.headers,
        body: prepared.body,
      });

      if (putResponse.ok) {
        const updated = await handleResponse<
          BackendWorkflowDetail | BackendWorkflowCreateResponse
        >(putResponse);
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

      if (putResponse.status === 404) {
        return createOrReuseExistingWorkflow();
      }

      if ([405, 501].includes(putResponse.status)) {
        throw new WorkflowAPIError(
          "Backend workflow update endpoint is not available yet.",
          putResponse.status,
          "UNSUPPORTED_UPDATE"
        );
      }

      await handleResponse(putResponse);
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

  /**
   * Upload a thumbnail image for a workflow.
   * Sends multipart/form-data to PATCH /api/workflows/<id>/thumbnail/.
   * Returns the stored URL from the backend, or null if the endpoint is
   * unavailable — callers should fall back to localStorage in that case.
   */
  uploadThumbnail: async (workflowId: string, file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("thumbnail", file);
      const response = await fetchWithTimeout(
        `${WORKFLOW_DETAIL_ENDPOINT(workflowId)}/thumbnail`,
        { method: "PATCH", body: formData },
        DEFAULT_TIMEOUT
      );
      if (!response.ok) return null;
      const data = (await parseJsonSafe(response)) as Record<string, unknown>;
      return typeof data?.thumbnail === "string" ? data.thumbnail : null;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
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

  activate: async (id: string): Promise<void> => {
    const response = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    if (!response.ok) {
      // Fallback: fetch full workflow and PUT it back with isActive toggled
      const workflow = await workflowAPI.get(id);
      const payload = toBackendWorkflowPayload({ ...workflow, isActive: true });
      const fallbackResponse = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await handleResponse(fallbackResponse);
    }
  },

  deactivate: async (id: string): Promise<void> => {
    const response = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    if (!response.ok) {
      // Fallback: fetch full workflow and PUT it back with isActive toggled
      const workflow = await workflowAPI.get(id);
      const payload = toBackendWorkflowPayload({ ...workflow, isActive: false });
      const fallbackResponse = await fetchWithTimeout(WORKFLOW_DETAIL_ENDPOINT(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await handleResponse(fallbackResponse);
    }
  },

  execute: async (
    id: string,
    options?: {
      input?: string;
      inputText?: string;
      input_text?: string;
      modelId?: string;
      model_id?: string;
    }
  ): Promise<ExecutionResult> => {
    const inputText = (
      options?.input ||
      options?.input_text ||
      options?.inputText ||
      ""
    ).trim();
    const modelId = options?.model_id || options?.modelId || "";

    if (!inputText) {
      throw new WorkflowAPIError(
        "input is required to execute a workflow.",
        400,
        "INVALID_INPUT"
      );
    }

    const response = await fetchWithTimeout(
      `${WORKFLOW_DETAIL_ENDPOINT(id)}/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputText, model_id: modelId }),
      },
      60000
    );

    const data = await handleResponse<BackendWorkflowExecutionResponse>(response);
    return toExecutionResult(id, data);
  },

  /**
   * Execute a workflow with SSE streaming.
   * Returns an abort controller so the caller can cancel the stream.
   */
  executeStream: async (
    id: string,
    inputText: string,
    callbacks: StreamCallbacks
  ): Promise<{ abort: () => void }> => {
    const trimmedInput = inputText.trim();

    if (!trimmedInput) {
      throw new WorkflowAPIError(
        "input is required to execute a workflow.",
        400,
        "INVALID_INPUT"
      );
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await apiFetch(`${WORKFLOW_DETAIL_ENDPOINT(id)}/execute/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ input: trimmedInput }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          callbacks.onError?.({
            event: "error",
            error: errorText || `HTTP ${response.status}`,
            error_code: `HTTP_${response.status}`,
          });
          return;
        }

        await processSseStream(response, callbacks, controller.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        callbacks.onError?.({
          event: "error",
          error: error instanceof Error ? error.message : "Stream failed",
          error_code: "STREAM_ERROR",
        });
      }
    })();

    return { abort: () => controller.abort() };
  },

  getExecutions: async (
    id: string
  ): Promise<{ executions: ExecutionResult[]; total: number }> => {
    const response = await fetchWithTimeout(`${WORKFLOW_DETAIL_ENDPOINT(id)}/runs`, {
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

  // ===========================================================================
  // CHATBOARD
  // ===========================================================================

  /**
   * List all chat sessions for a workflow.
   * GET /workflow/{id}/chats
   */
  listChats: async (workflowId: string): Promise<WorkflowChatSession[]> => {
    const response = await fetchWithTimeout(WORKFLOW_CHATS_ENDPOINT(workflowId), {
      method: "GET",
    });
    const data = await handleResponse<unknown[]>(response);
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      id: String(item.chat_id || ""),
      title: String(item.chat_title || "Untitled"),
      message_count: typeof item.message_count === "number" ? item.message_count : undefined,
    })).filter((s) => Boolean(s.id));
  },

  /**
   * Start a new chat conversation for a workflow.
   * POST /workflow/{id}/chats/create — returns an SSE stream.
   * The chat_id is included in the X-Chat-Id response header.
   */
  chatNew: async (
    workflowId: string,
    input: string,
    modelId: string,
    callbacks: StreamCallbacks & { onChatCreated?: (chatId: string) => void }
  ): Promise<{ abort: () => void }> => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      throw new WorkflowAPIError("input is required.", 400, "INVALID_INPUT");
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await apiFetch(WORKFLOW_CHATS_CREATE_ENDPOINT(workflowId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ input: trimmedInput, model_id: modelId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          callbacks.onError?.({
            event: "error",
            error: errorText || `HTTP ${response.status}`,
            error_code: `HTTP_${response.status}`,
          });
          return;
        }

        const chatId = response.headers.get("X-Chat-Id") || "";
        if (chatId) callbacks.onChatCreated?.(chatId);

        await processSseStream(response, callbacks, controller.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        callbacks.onError?.({
          event: "error",
          error: error instanceof Error ? error.message : "Stream failed",
          error_code: "STREAM_ERROR",
        });
      }
    })();

    return { abort: () => controller.abort() };
  },

  /**
   * Continue an existing chat conversation.
   * POST /workflow/{id}/chats/{chat_id}/stream — returns an SSE stream.
   */
  chatContinue: async (
    workflowId: string,
    chatId: string,
    input: string,
    modelId: string,
    callbacks: StreamCallbacks
  ): Promise<{ abort: () => void }> => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      throw new WorkflowAPIError("input is required.", 400, "INVALID_INPUT");
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await apiFetch(WORKFLOW_CHAT_STREAM_ENDPOINT(workflowId, chatId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ input: trimmedInput, model_id: modelId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          callbacks.onError?.({
            event: "error",
            error: errorText || `HTTP ${response.status}`,
            error_code: `HTTP_${response.status}`,
          });
          return;
        }

        await processSseStream(response, callbacks, controller.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        callbacks.onError?.({
          event: "error",
          error: error instanceof Error ? error.message : "Stream failed",
          error_code: "STREAM_ERROR",
        });
      }
    })();

    return { abort: () => controller.abort() };
  },

  /**
   * Get all messages for a workflow chat.
   * GET /workflow/{id}/chats/{chat_id}/messages
   */
  getChatMessages: async (
    workflowId: string,
    chatId: string
  ): Promise<WorkflowChatMessage[]> => {
    const response = await fetchWithTimeout(
      WORKFLOW_CHAT_MESSAGES_ENDPOINT(workflowId, chatId),
      { method: "GET" }
    );
    const data = await handleResponse<WorkflowChatMessage[]>(response);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Stop an in-progress workflow chat generation.
   * POST /workflow/{id}/chats/{chat_id}/stop
   */
  stopChat: async (workflowId: string, chatId: string): Promise<void> => {
    const response = await fetchWithTimeout(
      WORKFLOW_CHAT_STOP_ENDPOINT(workflowId, chatId),
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    await handleResponse(response);
  },

  /**
   * Rename a workflow chat.
   * PATCH /workflow/{id}/chats/rename
   */
  renameChat: async (
    workflowId: string,
    chatId: string,
    chatTitle: string
  ): Promise<void> => {
    const response = await fetchWithTimeout(
      WORKFLOW_CHATS_RENAME_ENDPOINT(workflowId),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, chat_title: chatTitle }),
      }
    );
    await handleResponse(response);
  },

  /**
   * Delete a workflow chat.
   * DELETE /workflow/{id}/chats
   */
  deleteChat: async (workflowId: string, chatId: string): Promise<void> => {
    const response = await fetchWithTimeout(
      WORKFLOW_CHATS_ENDPOINT(workflowId),
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      }
    );
    await handleResponse(response);
  },

  /**
   * Delete a message from a workflow chat.
   * DELETE /workflow/{id}/chats/{chat_id}/message/{message_id}
   */
  deleteChatMessage: async (
    workflowId: string,
    chatId: string,
    messageId: string
  ): Promise<void> => {
    const response = await fetchWithTimeout(
      WORKFLOW_CHAT_DELETE_MESSAGE_ENDPOINT(workflowId, chatId, messageId),
      { method: "DELETE" }
    );
    await handleResponse(response);
  },

  // ===========================================================================
  // DATA FETCHERS (for node inspector dropdowns)
  // ===========================================================================

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
      { method: "POST", body: formData },
      120000
    );

    return handleResponse(response);
  },

  fetchChats: async (): Promise<
    Array<{ id: string; name: string; pinnedDate?: string }>
  > => {
    try {
      const response = await fetchWithTimeout(CHATS_ENDPOINT, { method: "GET" });
      if (!response.ok) return [];

      const rawData = await response.json();
      const chatList = Array.isArray(rawData) ? rawData : [];

      return chatList
        .map((chat: Record<string, unknown>) => ({
          id: String(chat.id || ""),
          name: String(chat.chat_title || chat.id || "Untitled Chat"),
          pinnedDate: typeof chat.updated_at === "string" ? chat.updated_at : undefined,
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
      const modelList = Array.isArray(rawData) ? rawData : [];

      return modelList
        .map((model: Record<string, unknown>) => {
          const id = String(model.model_id || "");
          const modelTypeRaw = String(model.model_plan_type || "").toLowerCase();

          return {
            id,
            modelId: id,
            name: String(model.model_name || "Unknown Model"),
            companyName: String(model.model_provider || "Unknown"),
            description: String(model.model_description || ""),
            logo: "",
            modelType: (modelTypeRaw.includes("free") ? "free" : "paid") as "free" | "paid",
            sdkLibrary: "",
            inputModalities: Array.isArray(model.model_inputs) ? model.model_inputs : [],
            outputModalities: Array.isArray(model.model_outputs) ? model.model_outputs : [],
            inputLimit: typeof model.model_context_window === "number" ? model.model_context_window : 0,
            outputLimit: typeof model.model_output_size === "number" ? model.model_output_size : 0,
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
      status?: "active" | "paused";
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
        .map((persona: Record<string, unknown>) => {
          const id = String(persona.id || "");
          const name =
            typeof persona.name === "string" && persona.name.trim().length > 0
              ? persona.name
              : "Untitled Persona";
          const prompt =
            typeof persona.prompt === "string" ? persona.prompt : "";
          const description = prompt.slice(0, 140);
          const modelId =
            persona.model_id !== undefined && persona.model_id !== null
              ? String(persona.model_id)
              : persona.modelId !== undefined && persona.modelId !== null
              ? String(persona.modelId)
              : undefined;
          const rawImageUrl =
            typeof persona.image_url === "string"
              ? persona.image_url
              : typeof persona.imageUrl === "string"
                ? persona.imageUrl
                : typeof persona.image === "string"
                  ? persona.image
                  : "";
          const image = rawImageUrl
            ? rawImageUrl.startsWith("http") ||
              rawImageUrl.startsWith("data:") ||
              rawImageUrl.startsWith("blob:")
              ? rawImageUrl
              : `${API_BASE_URL}${rawImageUrl.startsWith("/") ? "" : "/"}${rawImageUrl}`
            : undefined;
          // Backend uses "completed" for paused, "test" for active
          const status: "active" | "paused" =
            persona.status === "completed" ? "paused" : "active";

          return { id, name, description, modelId, image, status };
        })
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
        .map((pin: Record<string, unknown>) => {
          const id = String(pin.id || "");
          const title =
            typeof pin.title === "string" && pin.title.trim().length > 0
              ? pin.title
              : typeof pin.content === "string" && pin.content.trim().length > 0
                ? pin.content
                : "Untitled Pin";
          const content = typeof pin.content === "string" ? pin.content : "";
          const text =
            content ||
            (typeof pin.title === "string" ? pin.title : "") ||
            "";
          const tags = Array.isArray(pin.tags)
            ? pin.tags
                .filter((tag): tag is string => typeof tag === "string")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [];
          const folderId =
            pin.folderId !== undefined && pin.folderId !== null
              ? String(pin.folderId)
              : pin.folder_id !== undefined && pin.folder_id !== null
                ? String(pin.folder_id)
                : undefined;
          const folderName =
            typeof pin.folderName === "string"
              ? pin.folderName
              : typeof pin.folder_name === "string"
                ? pin.folder_name
                : typeof pin.folder === "object" && pin.folder !== null
                  ? (() => {
                      const folder = pin.folder as Record<string, unknown>;
                      if (typeof folder.name === "string") return folder.name;
                      if (typeof folder.folder_name === "string") return folder.folder_name;
                      return undefined;
                    })()
                  : undefined;
          const chatId =
            pin.chat !== undefined && pin.chat !== null
              ? String(pin.chat)
              : pin.sourceChatId !== undefined && pin.sourceChatId !== null
                ? String(pin.sourceChatId)
                : undefined;
          const createdAt =
            typeof pin.created_at === "string" ? pin.created_at : undefined;

          return {
            id,
            name: title,
            title,
            text,
            content,
            tags,
            folderId,
            folderName,
            chatId,
            created_at: createdAt,
            pinnedDate: createdAt,
          };
        })
        .filter((pin: { id: string }) => Boolean(pin.id));
    } catch {
      return [];
    }
  },

  fetchPinFolders: async (): Promise<
    Array<{
      id: string;
      name: string;
      folder_name?: string;
      pin_count?: number;
      created_at?: string;
    }>
  > => {
    try {
      const response = await fetchWithTimeout(PIN_FOLDERS_ENDPOINT, {
        method: "GET",
      });
      if (!response.ok) return [];

      const rawData = await response.json();
      const folders = Array.isArray(rawData) ? rawData : [];

      return folders
        .map((folder: Record<string, unknown>) => {
          const id = String(folder.id || "");
          const folderName =
            typeof folder.folder_name === "string"
              ? folder.folder_name
              : typeof folder.name === "string"
                ? folder.name
                : "";

          return {
            id,
            name: folderName,
            folder_name:
              typeof folder.folder_name === "string"
                ? folder.folder_name
                : folderName,
            pin_count:
              typeof folder.pin_count === "number"
                ? folder.pin_count
                : undefined,
            created_at:
              typeof folder.created_at === "string"
                ? folder.created_at
                : undefined,
          };
        })
        .filter((folder: { id: string; name: string }) => {
          return folder.id.length > 0 && folder.name.trim().length > 0;
        });
    } catch {
      return [];
    }
  },
};

export { WorkflowAPIError };
