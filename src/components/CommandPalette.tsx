import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  MessageSquare, 
  Settings, 
  LayoutDashboard, 
  Plus, 
  PanelLeftClose, 
  Moon, 
  Sun,
  Key,
  HardDrive,
  Palette
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function CommandPalette() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { 
    commandPaletteOpen, 
    setCommandPaletteOpen, 
    toggleSidebar,
    triggerNewChat 
  } = useApp();

  const runCommand = (command: () => void) => {
    setCommandPaletteOpen(false);
    command();
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => { navigate('/chat'); triggerNewChat(); })}>
            <Plus className="mr-2 h-4 w-4" />
            New Chat
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(toggleSidebar)}>
            <PanelLeftClose className="mr-2 h-4 w-4" />
            Toggle Sidebar
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Toggle Theme
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/chat'))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Go to Chat
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/admin'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to Admin
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => navigate('/settings/api-keys'))}>
            <Key className="mr-2 h-4 w-4" />
            API Keys
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/settings/storage'))}>
            <HardDrive className="mr-2 h-4 w-4" />
            Storage
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/settings/appearance'))}>
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
