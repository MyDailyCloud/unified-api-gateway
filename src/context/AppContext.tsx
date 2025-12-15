import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type AppModule = 'chat' | 'settings' | 'admin';
export type SidebarState = 'expanded' | 'mini';

interface AppState {
  sidebarState: SidebarState;
  currentModule: AppModule;
  commandPaletteOpen: boolean;
}

interface AppContextType extends AppState {
  toggleSidebar: () => void;
  setSidebarState: (state: SidebarState) => void;
  setCurrentModule: (module: AppModule) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  triggerNewChat: () => void;
  registerNewChatHandler: (handler: () => void) => void;
  isMini: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarState, setSidebarState] = useState<SidebarState>('expanded');
  const [currentModule, setCurrentModule] = useState<AppModule>('chat');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const newChatHandlerRef = useRef<(() => void) | null>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarState(prev => prev === 'expanded' ? 'mini' : 'expanded');
  }, []);

  const isMini = sidebarState === 'mini';

  const registerNewChatHandler = useCallback((handler: () => void) => {
    newChatHandlerRef.current = handler;
  }, []);

  const triggerNewChat = useCallback(() => {
    newChatHandlerRef.current?.();
  }, []);

  return (
    <AppContext.Provider value={{
      sidebarState,
      currentModule,
      commandPaletteOpen,
      toggleSidebar,
      setSidebarState,
      setCurrentModule,
      setCommandPaletteOpen,
      triggerNewChat,
      registerNewChatHandler,
      isMini,
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
