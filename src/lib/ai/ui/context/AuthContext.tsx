/**
 * Auth Context
 * Provides global authentication state
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth, type UseAuthReturn } from '../hooks/use-auth';

const AuthContext = createContext<UseAuthReturn | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): UseAuthReturn {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
