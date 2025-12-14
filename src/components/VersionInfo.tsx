import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Cpu, HardDrive, Check, X, Loader2, Server, Monitor } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VersionInfo {
  app: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
}

interface HealthStatus {
  initialized: boolean;
  storage: { type: string; storedKeys: number } | null;
  providers: string[];
}

export function VersionInfo() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      if (window.electron?.system) {
        setIsElectron(true);
        try {
          const [version, health] = await Promise.all([
            window.electron.system.getVersionInfo(),
            window.electron.system.getHealthStatus(),
          ]);
          setVersionInfo(version);
          setHealthStatus(health);
        } catch (error) {
          console.error('Failed to load version info:', error);
        }
      }
      setLoading(false);
    }
    loadInfo();
  }, []);

  if (!isElectron) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Running in browser mode
          </span>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading system info...</span>
        </CardContent>
      </Card>
    );
  }

  const StatusIcon = ({ ok }: { ok: boolean }) => (
    ok ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5 text-destructive" />
  );

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Version badges */}
            <div className="flex flex-wrap items-center gap-2">
              {versionInfo && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
                        App v{versionInfo.app}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Application version</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Cpu className="mr-1 h-3 w-3" />
                        Electron v{versionInfo.electron}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-xs">
                        <div>Chrome: v{versionInfo.chrome}</div>
                        <div>Node: {versionInfo.node}</div>
                        <div>Platform: {versionInfo.platform} ({versionInfo.arch})</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-border/50" />

            {/* Health status */}
            <div className="flex flex-wrap items-center gap-3">
              {healthStatus && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon ok={healthStatus.initialized} />
                        <span className="text-sm text-muted-foreground">Backend</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Backend {healthStatus.initialized ? 'initialized' : 'not initialized'}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon ok={healthStatus.storage !== null} />
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {healthStatus.storage?.type || 'Storage'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {healthStatus.storage 
                        ? `${healthStatus.storage.type} - ${healthStatus.storage.storedKeys} stored keys`
                        : 'Storage not available'}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon ok={healthStatus.providers.length > 0} />
                        <Server className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {healthStatus.providers.length} Providers
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {healthStatus.providers.length > 0 
                        ? `Registered: ${healthStatus.providers.slice(0, 5).join(', ')}${healthStatus.providers.length > 5 ? '...' : ''}`
                        : 'No providers registered'}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}