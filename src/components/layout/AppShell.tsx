import { ReactNode } from 'react';
import { ActivityBar } from './ActivityBar';
import { CollapsedSidebarToggle } from './AppSidebar';

interface AppShellProps {
  sidebar?: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Activity Bar - Fixed icon navigation */}
      <ActivityBar />

      {/* Sidebar - Context-specific navigation */}
      {sidebar}
      
      {/* Toggle button when sidebar is collapsed */}
      <CollapsedSidebarToggle />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
