import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type AppModule = 'chat' | 'settings' | 'admin';

interface AppState {
  sidebarCollapsed: boolean;
  currentModule: AppModule;
}

interface AppContextType extends AppState {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentModule: (module: AppModule) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentModule, setCurrentModule] = useState<AppModule>('chat');

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <AppContext.Provider value={{
      sidebarCollapsed,
      currentModule,
      toggleSidebar,
      setSidebarCollapsed,
      setCurrentModule,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
