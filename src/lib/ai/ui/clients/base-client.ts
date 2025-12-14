/**
 * Base API Client
 * Handles URL detection, token management, and HTTP requests
 */

const TOKEN_KEY = 'ai-server-auth-token';

export interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Detect the API base URL based on runtime environment
 */
export function getApiBaseUrl(): string {
  // Check for explicit configuration
  if (typeof window !== 'undefined') {
    // Vite environment variable
    const viteUrl = (import.meta as any).env?.VITE_AI_SERVER_URL;
    if (viteUrl) return viteUrl;
    
    // In production, use same origin
    if (window.location.hostname !== 'localhost') {
      return window.location.origin;
    }
  }
  
  // Default to localhost:3000 for development
  return 'http://localhost:3000';
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Set auth token
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && 
    (window as any).electron !== undefined;
}

/**
 * Make an API request
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;
  
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders as Record<string, string>,
  };
  
  // Add auth token if available and not skipped
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
    
    const contentType = response.headers.get('content-type');
    let data: T | undefined;
    
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      if (response.ok) {
        data = json as T;
      } else {
        return {
          error: json.error || json.message || 'Request failed',
          status: response.status,
        };
      }
    }
    
    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}
