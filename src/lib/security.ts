/**
 * Security utilities for input sanitization and XSS prevention
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes potentially dangerous tags and attributes
 */
export function sanitizeHTML(html: string): string {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html; // textContent automatically escapes HTML
  
  return temp.innerHTML;
}

/**
 * Escape special HTML characters to prevent XSS
 */
export function escapeHTML(text: string): string {
  if (!text) return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Sanitize URL to prevent javascript: and data: protocol attacks
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return '';
  }
  
  return url;
}

/**
 * Sanitize user input for search queries
 * Removes special regex characters to prevent ReDoS attacks
 */
export function sanitizeSearchInput(input: string): string {
  if (!input) return '';
  
  // Escape special regex characters
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and sanitize file name
 * Prevents path traversal attacks
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return '';
  
  // Remove path traversal attempts
  let clean = fileName.replace(/\.\./g, '');
  
  // Remove path separators
  clean = clean.replace(/[/\\]/g, '');
  
  // Remove null bytes
  clean = clean.replace(/\0/g, '');
  
  return clean.trim();
}

/**
 * Validate file type against whitelist
 */
export function isAllowedFileType(fileName: string, allowedTypes: string[]): boolean {
  if (!fileName) return false;
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  
  return allowedTypes.includes(extension);
}

/**
 * Validate file size
 */
export function isAllowedFileSize(size: number, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return size > 0 && size <= maxSizeInBytes;
}

/**
 * Sanitize object keys to prevent prototype pollution
 */
export function sanitizeObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const safe: Record<string, unknown> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip __proto__, constructor, prototype
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      safe[key] = obj[key];
    }
  }
  
  return safe as T;
}

/**
 * Clear sensitive data from memory
 */
export function clearSensitiveData(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        // Overwrite string with zeros
        obj[key] = '\0'.repeat(value.length);
      }
      obj[key] = null;
    }
  }
}

/**
 * Validate CSRF token format
 */
export function isValidCSRFToken(token: string | null): boolean {
  if (!token) return false;
  
  // CSRF tokens should be alphanumeric and of reasonable length
  return /^[a-zA-Z0-9-_]{32,128}$/.test(token);
}

/**
 * Sanitize JSON input to prevent injection
 */
export function sanitizeJSON(json: string): unknown {
  try {
    // Parse and re-stringify to ensure it's valid JSON
    const parsed = JSON.parse(json);
    
    // Validate that it doesn't contain functions or undefined
    if (typeof parsed === 'function') {
      throw new Error('Functions not allowed');
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Rate limiter for client-side actions
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  canProceed(): boolean {
    const now = Date.now();
    
    // Remove timestamps outside the current window
    this.timestamps = this.timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    
    this.timestamps.push(now);
    return true;
  }
  
  reset(): void {
    this.timestamps = [];
  }
}
