/**
 * useGatewayKeys Hook
 * Manages Gateway API Key operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listKeys,
  createKey,
  revokeKey,
  enableKey,
  disableKey,
  regenerateKey,
  updateKey,
  getKeyStats,
  type GatewayApiKey,
  type CreateKeyRequest,
  type CreateKeyResponse,
  type KeyStats,
} from '../clients/gateway-keys-client';

export interface UseGatewayKeysReturn {
  // State
  keys: GatewayApiKey[];
  stats: KeyStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  create: (request: CreateKeyRequest) => Promise<CreateKeyResponse | null>;
  revoke: (id: string) => Promise<boolean>;
  enable: (id: string) => Promise<boolean>;
  disable: (id: string) => Promise<boolean>;
  regenerate: (id: string) => Promise<CreateKeyResponse | null>;
  update: (id: string, updates: Partial<Pick<GatewayApiKey, 'name' | 'scopes' | 'rateLimit'>>) => Promise<boolean>;
}

export function useGatewayKeys(autoFetch = true): UseGatewayKeysReturn {
  const [keys, setKeys] = useState<GatewayApiKey[]>([]);
  const [stats, setStats] = useState<KeyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch keys and stats
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [keysData, statsData] = await Promise.all([
        listKeys(),
        getKeyStats(),
      ]);
      
      setKeys(keysData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch keys');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);
  
  // Create key
  const create = useCallback(async (request: CreateKeyRequest): Promise<CreateKeyResponse | null> => {
    try {
      setError(null);
      const result = await createKey(request);
      if (result) {
        await refresh();
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
      return null;
    }
  }, [refresh]);
  
  // Revoke key
  const revoke = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await revokeKey(id);
      if (success) {
        await refresh();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
      return false;
    }
  }, [refresh]);
  
  // Enable key
  const enable = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const result = await enableKey(id);
      if (result) {
        setKeys(prev => prev.map(k => k.id === id ? result : k));
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable key');
      return false;
    }
  }, []);
  
  // Disable key
  const disable = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const result = await disableKey(id);
      if (result) {
        setKeys(prev => prev.map(k => k.id === id ? result : k));
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable key');
      return false;
    }
  }, []);
  
  // Regenerate key
  const regenerate = useCallback(async (id: string): Promise<CreateKeyResponse | null> => {
    try {
      setError(null);
      const result = await regenerateKey(id);
      if (result) {
        await refresh();
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate key');
      return null;
    }
  }, [refresh]);
  
  // Update key
  const update = useCallback(async (
    id: string,
    updates: Partial<Pick<GatewayApiKey, 'name' | 'scopes' | 'rateLimit'>>
  ): Promise<boolean> => {
    try {
      setError(null);
      const result = await updateKey(id, updates);
      if (result) {
        setKeys(prev => prev.map(k => k.id === id ? result : k));
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update key');
      return false;
    }
  }, []);
  
  return {
    keys,
    stats,
    isLoading,
    error,
    refresh,
    create,
    revoke,
    enable,
    disable,
    regenerate,
    update,
  };
}
