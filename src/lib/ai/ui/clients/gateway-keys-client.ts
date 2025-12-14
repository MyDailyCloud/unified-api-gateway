/**
 * Gateway Keys API Client
 */

import { apiRequest } from './base-client';

export interface GatewayApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: number;
  expiresAt?: number;
  enabled: boolean;
  scopes: string[];
  rateLimit?: number;
  lastUsedAt?: number;
  usageCount: number;
}

export interface CreateKeyRequest {
  name: string;
  expiresIn?: number;
  scopes?: string[];
  rateLimit?: number;
}

export interface CreateKeyResponse {
  key: GatewayApiKey;
  plainTextKey: string;
}

export interface KeyStats {
  total: number;
  active: number;
  disabled: number;
  expired: number;
  totalUsage: number;
}

const BASE_PATH = '/api/gateway-keys';

/**
 * List all gateway keys
 */
export async function listKeys(): Promise<GatewayApiKey[]> {
  const response = await apiRequest<{ keys: GatewayApiKey[] }>(BASE_PATH);
  return response.data?.keys || [];
}

/**
 * Get a specific key by ID
 */
export async function getKey(id: string): Promise<GatewayApiKey | null> {
  const response = await apiRequest<{ key: GatewayApiKey }>(`${BASE_PATH}/${id}`);
  return response.data?.key || null;
}

/**
 * Create a new gateway key
 */
export async function createKey(request: CreateKeyRequest): Promise<CreateKeyResponse | null> {
  const response = await apiRequest<CreateKeyResponse>(BASE_PATH, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  
  if (response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to create key');
}

/**
 * Update a gateway key
 */
export async function updateKey(
  id: string,
  updates: Partial<Pick<GatewayApiKey, 'name' | 'scopes' | 'rateLimit'>>
): Promise<GatewayApiKey | null> {
  const response = await apiRequest<{ key: GatewayApiKey }>(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return response.data?.key || null;
}

/**
 * Revoke (delete) a gateway key
 */
export async function revokeKey(id: string): Promise<boolean> {
  const response = await apiRequest(`${BASE_PATH}/${id}`, {
    method: 'DELETE',
  });
  return response.status === 200 || response.status === 204;
}

/**
 * Enable a gateway key
 */
export async function enableKey(id: string): Promise<GatewayApiKey | null> {
  const response = await apiRequest<{ key: GatewayApiKey }>(`${BASE_PATH}/${id}/enable`, {
    method: 'POST',
  });
  return response.data?.key || null;
}

/**
 * Disable a gateway key
 */
export async function disableKey(id: string): Promise<GatewayApiKey | null> {
  const response = await apiRequest<{ key: GatewayApiKey }>(`${BASE_PATH}/${id}/disable`, {
    method: 'POST',
  });
  return response.data?.key || null;
}

/**
 * Regenerate a gateway key
 */
export async function regenerateKey(id: string): Promise<CreateKeyResponse | null> {
  const response = await apiRequest<CreateKeyResponse>(`${BASE_PATH}/${id}/regenerate`, {
    method: 'POST',
  });
  
  if (response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to regenerate key');
}

/**
 * Get key statistics
 */
export async function getKeyStats(): Promise<KeyStats> {
  const response = await apiRequest<KeyStats>(`${BASE_PATH}/stats`);
  return response.data || {
    total: 0,
    active: 0,
    disabled: 0,
    expired: 0,
    totalUsage: 0,
  };
}
