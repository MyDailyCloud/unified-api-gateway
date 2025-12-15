import { ReactNode } from 'react';
import { ActivityBar } from './ActivityBar';
import { CollapsedSidebarToggle } from './AppSidebar';
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
  const { sidebarCollapsed } = useApp();

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Activity Bar - Fixed icon navigation */}
      <ActivityBar />

      {/* Resizable Content Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1" autoSaveId="app-sidebar-layout">
        {/* Sidebar Panel - collapsible with min/max sizes */}
        {!sidebarCollapsed && sidebar && (
          <>
            <ResizablePanel 
              id="sidebar"
              defaultSize={20} 
              minSize={12} 
              maxSize={35}
              className="min-w-[180px]"
            >
              {sidebar}
            </ResizablePanel>
            <ResizableHandle withHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
          </>
        )}
        
        {/* Toggle button when sidebar is collapsed */}
        {sidebarCollapsed && <CollapsedSidebarToggle />}

        {/* Main Content Panel */}
        <ResizablePanel id="main" defaultSize={80}>
          <main className="h-full flex flex-col overflow-hidden relative">
            {children}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
