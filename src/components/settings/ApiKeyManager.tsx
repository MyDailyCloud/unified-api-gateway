import { useState, useEffect } from 'react';
import { ProviderCard } from './ProviderCard';
import { ApiKeyConfigDialog } from './ApiKeyConfigDialog';
import { 
  PROVIDER_METADATA, 
  PROVIDER_CATEGORIES,
  getProvidersByCategory,
  type ProviderMetadata,
  type ProviderCategory,
} from '@/lib/ai/providers-metadata';
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

interface ProviderStatus {
  hasKey: boolean;
  isValid?: boolean;
  lastUpdated?: number;
}

export function ApiKeyManager() {
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({});
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderMetadata | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const [validatingProvider, setValidatingProvider] = useState<string | null>(null);
  const { toast } = useToast();

  // Load provider status on mount
  useEffect(() => {
    loadProviderStatus();
  }, []);

  const loadProviderStatus = async () => {
    if (!window.electron?.apiKeys) {
      // Running in browser - use mock data
      return;
    }

    try {
      const result = await window.electron.apiKeys.list();
      const status: Record<string, ProviderStatus> = {};
      result.providers.forEach((p) => {
        status[p.provider] = {
          hasKey: p.hasKey,
          lastUpdated: p.lastUpdated,
        };
      });
      setProviderStatus(status);
    } catch (error) {
      console.error('Failed to load provider status:', error);
    }
  };

  const handleConfigure = (provider: ProviderMetadata) => {
    setSelectedProvider(provider);
    setConfigDialogOpen(true);
  };

  const handleSaveApiKey = async (apiKey: string, baseUrl?: string) => {
    if (!selectedProvider) return;

    if (!window.electron?.apiKeys) {
      toast({
        title: 'Not available',
        description: 'API key storage requires Electron environment',
        variant: 'destructive',
      });
      return;
    }

    const result = await window.electron.apiKeys.set(selectedProvider.id, apiKey);
    
    if (result.success) {
      toast({
        title: 'API Key saved',
        description: `${selectedProvider.name} API key has been securely stored.`,
      });
      
      // Update local state
      setProviderStatus((prev) => ({
        ...prev,
        [selectedProvider.id]: { hasKey: true, lastUpdated: Date.now() },
      }));
      
      // Validate the key
      handleValidate(selectedProvider.id);
    } else {
      throw new Error(result.error || 'Failed to save API key');
    }
  };

  const handleDelete = (providerId: string) => {
    setProviderToDelete(providerId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!providerToDelete || !window.electron?.apiKeys) return;

    const result = await window.electron.apiKeys.delete(providerToDelete);
    
    if (result.success) {
      toast({
        title: 'API Key deleted',
        description: `${PROVIDER_METADATA[providerToDelete]?.name || providerToDelete} API key has been removed.`,
      });
      
      setProviderStatus((prev) => {
        const newStatus = { ...prev };
        delete newStatus[providerToDelete];
        return newStatus;
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete API key',
        variant: 'destructive',
      });
    }
    
    setDeleteDialogOpen(false);
    setProviderToDelete(null);
  };

  const handleValidate = async (providerId: string) => {
    if (!window.electron?.apiKeys) return;

    setValidatingProvider(providerId);
    
    try {
      const result = await window.electron.apiKeys.validate(providerId);
      
      setProviderStatus((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          isValid: result.valid,
        },
      }));

      if (result.valid) {
        toast({
          title: 'Valid',
          description: `${PROVIDER_METADATA[providerId]?.name || providerId} API key is valid.`,
        });
      } else {
        toast({
          title: 'Invalid',
          description: result.error || 'API key validation failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to validate API key',
        variant: 'destructive',
      });
    } finally {
      setValidatingProvider(null);
    }
  };

  const categories: ProviderCategory[] = ['cloud', 'china', 'local'];

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const providers = getProvidersByCategory(category);
        const categoryInfo = PROVIDER_CATEGORIES[category];
        
        return (
          <div key={category} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{categoryInfo.name}</h2>
              <p className="text-sm text-muted-foreground">{categoryInfo.description}</p>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => {
                const status = providerStatus[provider.id];
                return (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    hasKey={status?.hasKey || false}
                    isValid={status?.isValid}
                    isValidating={validatingProvider === provider.id}
                    onConfigure={() => handleConfigure(provider)}
                    onDelete={() => handleDelete(provider.id)}
                    onValidate={() => handleValidate(provider.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <ApiKeyConfigDialog
        provider={selectedProvider}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSave={handleSaveApiKey}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the API key for{' '}
              {providerToDelete && PROVIDER_METADATA[providerToDelete]?.name}.
              You'll need to reconfigure it to use this provider again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
