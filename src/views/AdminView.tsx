import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toolbar } from '@/components/layout/Toolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/context/AppContext';
import AdminDashboard from '@/pages/AdminDashboard';

export default function AdminView() {
  const { setCurrentModule } = useApp();

  useEffect(() => {
    setCurrentModule('admin');
  }, [setCurrentModule]);

  return (
    <AppShell>
      <Toolbar title="Admin Dashboard" />
      <ScrollArea className="flex-1">
        <AdminDashboard />
      </ScrollArea>
    </AppShell>
  );
}
