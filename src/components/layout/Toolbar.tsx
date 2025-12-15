import { ReactNode } from 'react';

interface ToolbarProps {
  title?: string;
  children?: ReactNode;
}

export function Toolbar({ title, children }: ToolbarProps) {
  return (
    <header className="h-12 min-h-[48px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {title && <h1 className="font-semibold text-sm">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}
