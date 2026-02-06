import { WorkflowDTO, WorkflowMetadata, ExecutionResult, NodeExecutionResult } from './types';
import { API_BASE_URL, MODELS_ENDPOINT, PERSONAS_ENDPOINT } from '@/lib/config';
import { apiFetch } from '@/lib/api/client';

// API configuration
const WORKFLOWS_ENDPOINT = `${API_BASE_URL}/workflows`;
const PINS_ENDPOINT = `${API_BASE_URL}/pins`;

// Error handling
class WorkflowAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'WorkflowAPIError';
  }
}

// Fetch with timeout
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = 30000
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for authentication
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WorkflowAPIError('Request timeout', 408, 'TIMEOUT');
    }
    throw error;
  }
};

// Handle API response
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new WorkflowAPIError(
      error.message || 'API request failed',
      response.status,
      error.code
    );
  }
  return response.json();
};

// Workflow API Service
export const workflowAPI = {
  // List all workflows (with pagination)
  list: async (params?: {
    page?: number;
    limit?: number;
    tags?: string[];
    search?: string;
  }): Promise<{ workflows: WorkflowMetadata[]; total: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.tags?.length) queryParams.append('tags', params.tags.join(','));
    if (params?.search) queryParams.append('search', params.search);

    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}?${queryParams.toString()}`,
      { method: 'GET' }
    );

    return handleResponse(response);
  },

  // Get single workflow by ID
  get: async (id: string): Promise<WorkflowDTO> => {
    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}/${id}`,
      { method: 'GET' }
    );

    return handleResponse(response);
  },

  // Create new workflow
  create: async (workflow: Omit<WorkflowDTO, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDTO> => {
    const response = await fetchWithTimeout(
      WORKFLOWS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      }
    );

    return handleResponse(response);
  },

  // Update existing workflow
  update: async (id: string, workflow: Partial<WorkflowDTO>): Promise<WorkflowDTO> => {
    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      }
    );

    return handleResponse(response);
  },

  // Delete workflow
  delete: async (id: string): Promise<void> => {
    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}/${id}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new WorkflowAPIError('Failed to delete workflow', response.status);
    }
  },

  // Execute workflow
  execute: async (
    id: string,
    options?: {
      mode?: 'test' | 'production';
      variables?: Record<string, any>;
    }
  ): Promise<ExecutionResult> => {
    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}/${id}/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {}),
      },
      60000 // 60 second timeout for execution
    );

    return handleResponse(response);
  },

  // Get execution history
  getExecutions: async (
    id: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{ executions: ExecutionResult[]; total: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}/${id}/executions?${queryParams.toString()}`,
      { method: 'GET' }
    );

    return handleResponse(response);
  },

  // Share workflow
  share: async (id: string, options: { isPublic: boolean }): Promise<{ shareUrl: string }> => {
    const response = await fetchWithTimeout(
      `${WORKFLOWS_ENDPOINT}/${id}/share`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      }
    );

    return handleResponse(response);
  },

  // Upload file for document node
  uploadFile: async (file: File): Promise<{ fileId: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/files/upload`,
      {
        method: 'POST',
        body: formData,
      },
      120000 // 2 minutes for file upload
    );

    return handleResponse(response);
  },

  // Fetch all chats
  fetchChats: async (): Promise<Array<{ id: string; name: string; pinnedDate?: string }>> => {
    try {
      console.log('Fetching chats from: /chats/');
      const response = await apiFetch('/chats/', { method: 'GET' });
      
      if (!response.ok) {
        console.error('Chats fetch failed:', response.status, response.statusText);
        return [];
      }
      
      const rawData = await response.json();
      console.log('Raw chats data:', rawData);
      
      // Handle different response structures
      const chatList = Array.isArray(rawData) 
        ? rawData 
        : Array.isArray(rawData?.results) 
          ? rawData.results 
          : Array.isArray(rawData?.chats) 
            ? rawData.chats 
            : [];
      
      const processedChats = chatList.map((chat: any) => ({
        id: String(chat.id || chat.chatId || ''),
        name: chat.name || chat.title || `Chat ${chat.id || ''}`,
        pinnedDate: chat.pinnedDate || chat.createdAt || chat.updated_at || undefined,
      }));
      
      console.log('Processed chats:', processedChats);
      return processedChats;
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      return [];
    }
  },

  // Fetch all models
  fetchModels: async (): Promise<Array<{ 
    id: string; 
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
  }>> => {
    try {
      console.log('Fetching models from:', MODELS_ENDPOINT);
      const response = await fetchWithTimeout(MODELS_ENDPOINT, { method: 'GET' });
      
      if (!response.ok) {
        console.error('Models fetch failed:', response.status, response.statusText);
        return [];
      }
      
      const rawData = await response.json();
      console.log('Raw models data:', rawData);
      
      // Normalize backend model structure
      const modelList = Array.isArray(rawData) 
        ? rawData 
        : Array.isArray(rawData?.results) 
          ? rawData.results 
          : Array.isArray(rawData?.models) 
            ? rawData.models 
            : [];
      
      const processedModels = modelList.map((model: any) => ({
        id: String(model.id || model.modelId || ''),
        modelId: String(model.modelId || model.id || ''),
        name: model.modelName || model.name || 'Unknown Model',
        companyName: model.companyName || model.providerName || model.provider || 'Unknown',
        description: model.description || '',
        logo: model.logo || '',
        modelType: (model.modelType || model.planType?.toLowerCase().includes('free') ? 'free' : 'paid') as "free" | "paid",
        sdkLibrary: model.sdkLibrary || '',
        inputModalities: model.inputModalities || [],
        outputModalities: model.outputModalities || [],
        inputLimit: typeof model.inputLimit === 'number' ? model.inputLimit : 0,
        outputLimit: typeof model.outputLimit === 'number' ? model.outputLimit : 0,
      }));
      
      console.log('Processed models:', processedModels);
      return processedModels;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  },

  // Fetch all personas
  fetchPersonas: async (): Promise<Array<{ id: string; name: string; description?: string; image?: string }>> => {
    try {
      console.log('Fetching personas from:', PERSONAS_ENDPOINT);
      const response = await fetchWithTimeout(PERSONAS_ENDPOINT, { method: 'GET' });
      
      if (!response.ok) {
        console.error('Personas fetch failed:', response.status, response.statusText);
        return [];
      }
      
      const rawData = await response.json();
      console.log('Raw personas data:', rawData);
      
      // Handle backend persona structure
      const personaList = Array.isArray(rawData) ? rawData : [];
      
      const processedPersonas = personaList.map((persona: any) => ({
        id: String(persona.id),
        name: persona.name || 'Untitled Persona',
        description: persona.prompt?.slice(0, 140) || '',
        image: persona.imageUrl ? 
          (persona.imageUrl.startsWith('http') || persona.imageUrl.startsWith('data:') || persona.imageUrl.startsWith('blob:') 
            ? persona.imageUrl 
            : `${API_BASE_URL}${persona.imageUrl.startsWith('/') ? '' : '/'}${persona.imageUrl}`
          ) : null,
      }));
      
      console.log('Processed personas:', processedPersonas);
      return processedPersonas;
    } catch (error) {
      console.error('Failed to fetch personas:', error);
      return [];
    }
  },

  // Fetch all pins
  fetchPins: async (): Promise<Array<{ 
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
  }>> => {
    try {
      console.log('Fetching pins from:', PINS_ENDPOINT);
      const response = await fetchWithTimeout(PINS_ENDPOINT, { method: 'GET' });
      
      if (!response.ok) {
        console.error('Pins fetch failed:', response.status, response.statusText);
        return [];
      }
      
      const rawData = await response.json();
      console.log('Raw pins data:', rawData);
      
      const pinList = Array.isArray(rawData) ? rawData : [];
      
      const processedPins = pinList.map((pin: any) => ({
        id: String(pin.id),
        name: pin.title || pin.content || 'Untitled Pin',
        title: pin.title || pin.content || 'Untitled Pin',
        text: pin.content || pin.title || '',
        content: pin.content || '',
        tags: pin.tags || [],
        folderId: pin.folderId || pin.folder_id || undefined,
        folderName: pin.folderName || undefined,
        chatId: pin.chat || pin.sourceChatId || undefined,
        created_at: pin.created_at || undefined,
        pinnedDate: pin.created_at || undefined,
      }));
      
      console.log('Processed pins:', processedPins);
      return processedPins;
    } catch (error) {
      console.error('Failed to fetch pins:', error);
      return [];
    }
  },
};

export { WorkflowAPIError };
