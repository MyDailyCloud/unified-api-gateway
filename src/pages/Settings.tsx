import { Link } from 'react-router-dom';
import { ArrowLeft, Key, HardDrive, Info, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { StorageManager } from '@/components/settings/StorageManager';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { VersionInfo } from '@/components/VersionInfo';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your AI SDK</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs defaultValue="api-keys" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-2">
              <Info className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">API Keys</h2>
              <p className="text-muted-foreground">
                Configure API keys for AI providers. Keys are encrypted and stored locally.
              </p>
            </div>
            <Separator />
            <ApiKeyManager />
          </TabsContent>

          <TabsContent value="storage" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Storage</h2>
              <p className="text-muted-foreground">
                View storage usage and manage conversation history.
              </p>
            </div>
            <Separator />
            <StorageManager />
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Appearance</h2>
              <p className="text-muted-foreground">
                Customize the look and feel of the application.
              </p>
            </div>
            <Separator />
            <ThemeSelector />
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">About</h2>
              <p className="text-muted-foreground">
                Application information and health status.
              </p>
            </div>
            <Separator />
            <VersionInfo />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
