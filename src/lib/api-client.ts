/**
 * Secure API client with built-in rate limiting, retries, and error handling
 */

import { throttle, exponentialBackoff, CircuitBreaker, RequestQueue } from './throttle';
import { RateLimiter } from './security';
import { logger } from './logger';

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Global rate limiters for different endpoint types
const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
const uploadRateLimiter = new RateLimiter(10, 60000); // 10 uploads per minute
const chatRateLimiter = new RateLimiter(30, 60000); // 30 chat requests per minute

// Circuit breaker for API resilience
const apiCircuitBreaker = new CircuitBreaker(5, 30000);

// Request queue for managing concurrency
const requestQueue = new RequestQueue(5);

/**
 * Enhanced fetch with security features
 */
export async function secureFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  // Validate URL
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  // Check rate limit
  const isUpload = fetchOptions.method === 'POST' && fetchOptions.body instanceof FormData;
  const isChat = url.includes('/chat') || url.includes('/completion');
  
  const rateLimiter = isUpload ? uploadRateLimiter : isChat ? chatRateLimiter : apiRateLimiter;
  
  if (!rateLimiter.canProceed()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  // Execute with circuit breaker and retry logic
  return apiCircuitBreaker.execute(async () => {
    return exponentialBackoff(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          return data as T;
        } catch (error) {
          clearTimeout(timeoutId);
          
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              throw new Error('Request timeout');
            }
            logger.error('Fetch error:', { url, error: error.message });
          }
          
          throw error;
        }
      },
      retries,
      retryDelay
    );
  });
}

/**
 * Throttled API call wrapper
 * Prevents excessive API calls from rapid user actions
 */
export const throttledApiCall = throttle(
  async <T>(fn: () => Promise<T>): Promise<T> => {
    return requestQueue.add(fn);
  },
  1000
);

/**
 * Secure POST request with CSRF protection
 */
export async function securePost<T = unknown>(
  url: string,
  data: unknown,
  csrfToken: string | null,
  options: FetchOptions = {}
): Promise<T> {
  if (!csrfToken) {
    logger.warn('CSRF token missing for POST request');
  }

  return secureFetch<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken || '',
      ...options.headers,
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });
}

/**
 * Secure GET request
 */
export async function secureGet<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  return secureFetch<T>(url, {
    ...options,
    method: 'GET',
    credentials: 'include',
  });
}

/**
 * Secure file upload with validation
 */
export async function secureUpload<T = unknown>(
  url: string,
  file: File,
  csrfToken: string | null,
  options: FetchOptions = {}
): Promise<T> {
  // Validate file size (10MB max by default)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Allowed: PNG, JPEG, GIF, PDF');
  }

  const formData = new FormData();
  formData.append('file', file);

  return secureFetch<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken || '',
      ...options.headers,
    },
    body: formData,
    credentials: 'include',
  });
}

/**
 * Batch API requests
 */
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  batchSize = 5
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Stream handler with backpressure
 */
export async function handleStream(
  url: string,
  options: RequestInit,
  onChunk: (chunk: string) => void,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete chunks
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          onChunk(line);
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      onChunk(buffer);
    }
  } catch (error) {
    logger.error('Stream error:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    throw error;
  }
}
