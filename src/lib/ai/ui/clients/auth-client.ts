/**
 * Authentication API Client
 */

import { apiRequest, setAuthToken, clearAuthToken, getAuthToken } from './base-client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  mode: string;
  role?: string;
  isAdmin?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Login with username and password
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
    skipAuth: true,
  });
  
  if (response.data?.success && response.data.token) {
    setAuthToken(response.data.token);
    return response.data;
  }
  
  return {
    success: false,
    error: response.error || response.data?.error || 'Login failed',
  };
}

/**
 * Logout current session
 */
export async function logout(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) {
    clearAuthToken();
    return true;
  }
  
  const response = await apiRequest('/api/auth/logout', {
    method: 'POST',
  });
  
  clearAuthToken();
  return response.status === 200 || response.status === 204;
}

/**
 * Get current authentication status
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await apiRequest<AuthStatus>('/api/auth/status');
  
  if (response.data) {
    return response.data;
  }
  
  return {
    authenticated: false,
    mode: 'unknown',
  };
}

/**
 * Change password
 */
export async function changePassword(
  request: ChangePasswordRequest
): Promise<{ success: boolean; error?: string }> {
  const response = await apiRequest<{ success: boolean }>('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify(request),
  });
  
  if (response.data?.success) {
    return { success: true };
  }
  
  return {
    success: false,
    error: response.error || 'Failed to change password',
  };
}

/**
 * Check if user has valid session
 */
export function hasStoredToken(): boolean {
  return getAuthToken() !== null;
}
