import { Bell, ChevronRight, X } from "lucide-react";

interface UnreadActivityPromptProps {
  unreadCount: number;
  onTap: () => void;
  onDismiss: () => void;
}

export const UnreadActivityPrompt = ({ 
  unreadCount, 
  onTap, 
  onDismiss 
}: UnreadActivityPromptProps) => {
  if (unreadCount === 0) return null;
  
  return (
    <div 
      className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 cursor-pointer active:opacity-80 transition-opacity"
      onClick={onTap}
    >
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {unreadCount} new update{unreadCount !== 1 ? 's' : ''} from your team
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-600 dark:text-amber-400">View</span>
        <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onDismiss(); 
          }}
          className="text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300 p-1 -m-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
