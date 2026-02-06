import { WorkflowDTO, WorkflowMetadata, ExecutionResult, NodeExecutionResult } from './types';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const WORKFLOWS_ENDPOINT = `${API_BASE_URL}/workflows`;
const CHATS_ENDPOINT = `${API_BASE_URL}/chats`;
const MODELS_ENDPOINT = `${API_BASE_URL}/models`;
const PERSONAS_ENDPOINT = `${API_BASE_URL}/personas`;
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
      const response = await fetchWithTimeout(CHATS_ENDPOINT, { method: 'GET' });
      const data = await handleResponse<Array<{ id: string; name: string; pinnedDate?: string }>>(response);
      return data;
    } catch (error) {
      console.warn('Failed to fetch chats:', error);
      return [];
    }
  },

  // Fetch all models
  fetchModels: async (): Promise<Array<{ id: string; name: string; description?: string; logo?: string }>> => {
    try {
      const response = await fetchWithTimeout(MODELS_ENDPOINT, { method: 'GET' });
      const data = await handleResponse<Array<{ id: string; name: string; description?: string; logo?: string }>>(response);
      return data;
    } catch (error) {
      console.warn('Failed to fetch models:', error);
      return [];
    }
  },

  // Fetch all personas
  fetchPersonas: async (): Promise<Array<{ id: string; name: string; description?: string; image?: string }>> => {
    try {
      const response = await fetchWithTimeout(PERSONAS_ENDPOINT, { method: 'GET' });
      const data = await handleResponse<Array<{ id: string; name: string; description?: string; image?: string }>>(response);
      return data;
    } catch (error) {
      console.warn('Failed to fetch personas:', error);
      return [];
    }
  },

  // Fetch all pins
  fetchPins: async (): Promise<Array<{ id: string; name: string; pinnedDate?: string }>> => {
    try {
      const response = await fetchWithTimeout(PINS_ENDPOINT, { method: 'GET' });
      const data = await handleResponse<Array<{ id: string; name: string; pinnedDate?: string }>>(response);
      return data;
    } catch (error) {
      console.warn('Failed to fetch pins:', error);
      return [];
    }
  },
};

export { WorkflowAPIError };
