import { MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({ 
  conversations, 
  currentId, 
  onSelect, 
  onDelete 
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={cn(
            'group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
            currentId === conv.id 
              ? 'bg-accent text-accent-foreground' 
              : 'hover:bg-muted'
          )}
          onClick={() => onSelect(conv.id)}
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate text-sm">{conv.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conv.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
