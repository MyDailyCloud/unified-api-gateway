import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { toggleSidebar, setCommandPaletteOpen, triggerNewChat } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Command Palette: Ctrl/⌘ + K
      if (mod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // These shortcuts should work even in input fields
      if (mod) {
        // Toggle Sidebar: Ctrl/⌘ + B
        if (e.key === 'b') {
          e.preventDefault();
          toggleSidebar();
          return;
        }

        // Open Settings: Ctrl/⌘ + ,
        if (e.key === ',') {
          e.preventDefault();
          navigate('/settings');
          return;
        }

        // New Chat: Ctrl/⌘ + N (only if not in input field)
        if (e.key === 'n' && !isInputField) {
          e.preventDefault();
          navigate('/chat');
          triggerNewChat();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, toggleSidebar, setCommandPaletteOpen, triggerNewChat]);
}
