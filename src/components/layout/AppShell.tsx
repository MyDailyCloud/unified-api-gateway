import { ReactNode } from 'react';
import { ActivityBar } from './ActivityBar';
import { useApp } from '@/context/AppContext';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface AppShellProps {
  sidebar?: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const { isMini, setSidebarState } = useApp();

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Activity Bar - Fixed icon navigation */}
      <ActivityBar />

      {/* Resizable Content Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1" autoSaveId="app-sidebar-layout">
        {/* Sidebar Panel */}
        {sidebar && (
          <>
            <ResizablePanel 
              id="sidebar"
              defaultSize={20} 
              minSize={10} 
              maxSize={35}
              collapsedSize={4}
              collapsible={true}
              onCollapse={() => setSidebarState('mini')}
              onExpand={() => setSidebarState('expanded')}
              className="transition-all duration-300 ease-in-out"
            >
              <div className="h-full">
                {sidebar}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
          </>
        )}

        {/* Main Content Panel */}
        <ResizablePanel id="main" defaultSize={80}>
          <main className="h-full flex flex-col overflow-hidden">
            {children}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
