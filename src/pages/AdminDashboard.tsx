/**
 * Admin Dashboard Page
 * Authentication and Gateway Key Management
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LogOut, Settings, Shield, Key, User, Activity } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { 
  useAuth, 
  LoginForm, 
  ChangePasswordDialog, 
  GatewayKeyManager,
  RequestLogViewer,
  AuthProvider,
} from '@/lib/ai/ui';

function AdminDashboardContent() {
  const { 
    isAuthenticated, 
    isLoading, 
    isAdmin, 
    authMode, 
    error, 
    login, 
    logout, 
    changePassword 
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState('keys');

  // Show login form if not authenticated
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
            <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
              <Shield className="mr-1 h-3 w-3" />
              Admin Portal
            </Badge>
          </div>
        </header>

        {/* Login Form */}
        <main className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Admin Access</h1>
              <p className="mt-2 text-muted-foreground">
                Sign in to manage API keys and settings
              </p>
            </div>
            
            <LoginForm 
              onLogin={async (username, password) => login({ username, password })}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </main>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Admin Dashboard</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:flex">
              <User className="mr-1 h-3 w-3" />
              {authMode === 'electron' ? 'Local Admin' : 'Admin'}
            </Badge>
            
            <ChangePasswordDialog 
              onChangePassword={async (current, newPass) => changePassword({ currentPassword: current, newPassword: newPass })}
            />
            
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="keys" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="keys" className="space-y-6">
            <GatewayKeyManager />
          </TabsContent>
          
          <TabsContent value="logs" className="space-y-6">
            <RequestLogViewer />
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Server Settings</CardTitle>
                <CardDescription>
                  Configure server behavior and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Auth Mode</div>
                          <div className="text-sm text-muted-foreground capitalize">{authMode}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">Role</div>
                          <div className="text-sm text-muted-foreground">
                            {isAdmin ? 'Administrator' : 'User'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <h4 className="mb-2 font-medium">Security Tips</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Change the default admin password immediately</li>
                    <li>• Rotate API keys regularly</li>
                    <li>• Set appropriate rate limits for each key</li>
                    <li>• Monitor key usage for unusual activity</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AuthProvider>
      <AdminDashboardContent />
    </AuthProvider>
  );
}
