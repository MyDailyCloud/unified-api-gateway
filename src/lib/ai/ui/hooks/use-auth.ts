/**
 * useAuth Hook
 * Manages authentication state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  getAuthStatus,
  changePassword as apiChangePassword,
  hasStoredToken,
  type AuthStatus,
  type LoginRequest,
  type ChangePasswordRequest,
} from '../clients/auth-client';
import { isElectron, clearAuthToken } from '../clients/base-client';

export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  authMode: string;
  error: string | null;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (request: ChangePasswordRequest) => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState('unknown');
  const [error, setError] = useState<string | null>(null);
  
  // Check authentication status
  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const status = await getAuthStatus();
      setIsAuthenticated(status.authenticated);
      setIsAdmin(status.isAdmin || false);
      setAuthMode(status.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check auth status');
      setIsAuthenticated(false);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initialize auth state
  useEffect(() => {
    // In Electron, user is auto-authenticated
    if (isElectron()) {
      setIsAuthenticated(true);
      setIsAdmin(true);
      setAuthMode('electron');
      setIsLoading(false);
      return;
    }
    
    // Check if we have a stored token
    if (hasStoredToken()) {
      refreshStatus();
    } else {
      setIsLoading(false);
    }
  }, [refreshStatus]);
  
  // Login
  const login = useCallback(async (credentials: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await apiLogin(credentials);
      
      if (result.success) {
        setIsAuthenticated(true);
        setIsAdmin(true);
        setAuthMode('node');
        return true;
      } else {
        setError(result.error || 'Login failed');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await apiLogout();
    } catch {
      // Ignore logout errors
    } finally {
      clearAuthToken();
      setIsAuthenticated(false);
      setIsAdmin(false);
      setIsLoading(false);
    }
  }, []);
  
  // Change password
  const changePassword = useCallback(async (request: ChangePasswordRequest): Promise<boolean> => {
    try {
      setError(null);
      const result = await apiChangePassword(request);
      
      if (!result.success) {
        setError(result.error || 'Failed to change password');
        return false;
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
      return false;
    }
  }, []);
  
  return {
    isAuthenticated,
    isLoading,
    isAdmin,
    authMode,
    error,
    login,
    logout,
    changePassword,
    refreshStatus,
  };
}
