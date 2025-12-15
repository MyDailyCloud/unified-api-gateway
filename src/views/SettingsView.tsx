import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { SettingsSidebar } from '@/components/layout/AppSidebar';
import { Toolbar } from '@/components/layout/Toolbar';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { StorageManager } from '@/components/settings/StorageManager';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { VersionInfo } from '@/components/VersionInfo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/context/AppContext';

const tabTitles: Record<string, string> = {
  'api-keys': 'API Keys',
  'storage': 'Storage',
  'appearance': 'Appearance',
  'about': 'About',
};

const tabDescriptions: Record<string, string> = {
  'api-keys': 'Configure API keys for AI providers. Keys are encrypted and stored locally.',
  'storage': 'View storage usage and manage conversation history.',
  'appearance': 'Customize the look and feel of the application.',
  'about': 'Application information and health status.',
};

export default function SettingsView() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(tab || 'api-keys');
  const { setCurrentModule } = useApp();

  useEffect(() => {
    setCurrentModule('settings');
  }, [setCurrentModule]);

  useEffect(() => {
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [tab]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    navigate(`/settings/${newTab}`, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'api-keys':
        return <ApiKeyManager />;
      case 'storage':
        return <StorageManager />;
      case 'appearance':
        return <ThemeSelector />;
      case 'about':
        return <VersionInfo />;
      default:
        return <ApiKeyManager />;
    }
  };

  return (
    <AppShell
      sidebar={
        <SettingsSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      }
    >
      <Toolbar title={tabTitles[activeTab] || 'Settings'} />
      
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{tabTitles[activeTab]}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {tabDescriptions[activeTab]}
            </p>
          </div>
          {renderContent()}
        </div>
      </ScrollArea>
    </AppShell>
  );
}
