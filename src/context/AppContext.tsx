import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type AppModule = 'chat' | 'settings' | 'admin';

interface AppState {
  sidebarCollapsed: boolean;
  currentModule: AppModule;
  commandPaletteOpen: boolean;
}

interface AppContextType extends AppState {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentModule: (module: AppModule) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  triggerNewChat: () => void;
  registerNewChatHandler: (handler: () => void) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentModule, setCurrentModule] = useState<AppModule>('chat');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const newChatHandlerRef = useRef<(() => void) | null>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const registerNewChatHandler = useCallback((handler: () => void) => {
    newChatHandlerRef.current = handler;
  }, []);

  const triggerNewChat = useCallback(() => {
    newChatHandlerRef.current?.();
  }, []);

  return (
    <AppContext.Provider value={{
      sidebarCollapsed,
      currentModule,
      commandPaletteOpen,
      toggleSidebar,
      setSidebarCollapsed,
      setCurrentModule,
      setCommandPaletteOpen,
      triggerNewChat,
      registerNewChatHandler,
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
