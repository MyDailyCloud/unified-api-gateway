import { Plus, Key, HardDrive, Palette, Info, PanelLeftClose, PanelLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

// Chat sidebar content
interface ChatSidebarProps {
  conversations: Array<{ id: string; title: string; createdAt: Date; updatedAt: Date }>;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ChatSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
}: ChatSidebarProps) {
  const { isMini, toggleSidebar } = useApp();

  return (
    <div className="bg-sidebar-background border-r border-sidebar-border flex flex-col h-full w-full min-w-0 transition-all duration-300">
      <div className={cn(
        "h-12 px-3 flex items-center border-b border-sidebar-border",
        isMini ? "justify-center" : "justify-between"
      )}>
        {!isMini && <span className="font-medium text-sm text-sidebar-foreground">Conversations</span>}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
          {isMini ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <div className={cn("p-2", isMini && "px-1")}>
        {isMini ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onNewConversation} size="icon" className="w-full h-9">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>
        ) : (
          <Button onClick={onNewConversation} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className={cn("p-2 space-y-1", isMini && "px-1")}>
          {conversations.length === 0 ? (
            !isMini && <p className="text-center text-muted-foreground text-sm py-4">No conversations</p>
          ) : (
            conversations.map((conv) => (
              isMini ? (
                <Tooltip key={conv.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        'w-full flex items-center justify-center rounded-md p-2 cursor-pointer transition-colors',
                        currentConversationId === conv.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                      )}
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{conv.title}</TooltipContent>
                </Tooltip>
              ) : (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors',
                    currentConversationId === conv.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <span className="flex-1 truncate">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                  >
                    <span className="text-xs">×</span>
                  </Button>
                </div>
              )
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Settings sidebar content
const settingsTabs = [
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'about', label: 'About', icon: Info },
];

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const { isMini, toggleSidebar } = useApp();

  return (
    <div className="bg-sidebar-background border-r border-sidebar-border flex flex-col h-full w-full min-w-0 transition-all duration-300">
      <div className={cn(
        "h-12 px-3 flex items-center border-b border-sidebar-border",
        isMini ? "justify-center" : "justify-between"
      )}>
        {!isMini && <span className="font-medium text-sm text-sidebar-foreground">Settings</span>}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
          {isMini ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className={cn("p-2 space-y-1", isMini && "px-1")}>
          {settingsTabs.map((tab) => (
            isMini ? (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      'w-full flex items-center justify-center rounded-md p-2 transition-colors',
                      activeTab === tab.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{tab.label}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Collapsed sidebar toggle - no longer needed with mini state
export function CollapsedSidebarToggle() {
  return null;
}
