import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  HardDrive, 
  MessageSquare, 
  Trash2, 
  Download, 
  RefreshCw,
  Loader2,
  Database
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const electron = window.electron as any;

interface StorageStats {
  conversations: number;
  messages: number;
  cacheSize: number;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
}

export function StorageManager() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    if (electron?.storage) {
      try {
        const [statsResult, convsResult] = await Promise.all([
          electron.storage.getStats(),
          electron.conversations?.list() || { conversations: [] },
        ]);
        setStats(statsResult);
        setConversations(convsResult.conversations || []);
      } catch (error) {
        console.error('Failed to load storage data:', error);
      }
    } else {
      setStats({ conversations: 0, messages: 0, cacheSize: 0 });
    }
    
    setLoading(false);
  };

  const handleClearCache = async () => {
    if (!electron?.storage) return;
    
    setClearing(true);
    try {
      await electron.storage.clearCache();
      toast({ title: 'Cache cleared', description: 'Storage cache has been cleared.' });
      await loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to clear cache', variant: 'destructive' });
    } finally {
      setClearing(false);
      setClearDialogOpen(false);
    }
  };

  const handleExport = async () => {
    if (!electron?.storage) {
      toast({ title: 'Not available', description: 'Export requires Electron', variant: 'destructive' });
      return;
    }
    
    setExporting(true);
    try {
      const result = await electron.storage.exportData();
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-sdk-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: 'Data exported successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!electron?.conversations) return;
    try {
      await electron.conversations.delete(id);
      await loadData();
      toast({ title: 'Deleted', description: 'Conversation deleted.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.conversations || 0}</p>
                <p className="text-sm text-muted-foreground">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.messages || 0}</p>
                <p className="text-sm text-muted-foreground">Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatBytes(stats?.cacheSize || 0)}</p>
                <p className="text-sm text-muted-foreground">Cache Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Storage Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Data
          </Button>
          <Button variant="destructive" onClick={() => setClearDialogOpen(true)} disabled={clearing}>
            {clearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Clear Cache
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Conversations</CardTitle></CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No conversations yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div key={conv.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(conv.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteConversation(conv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cache?</AlertDialogTitle>
            <AlertDialogDescription>This will clear cached data. Conversations and API keys won't be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
