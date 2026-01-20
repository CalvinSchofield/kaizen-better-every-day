import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

interface MentionUser {
  user_id: string;
  name: string;
  profile_photo_url: string | null;
}

interface ConfirmedMention {
  userId: string;
  name: string;
  startIndex: number;
  endIndex: number;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange: (userIds: string[]) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  rows?: number;
  /** Optional recruit ID to filter mentions to upline/downline users who can see this recruit */
  recruitId?: string;
}

// Hook to get mentionable users - filtered by recruit context if recruitId provided
export const useMentionableUsers = (recruitId?: string) => {
  return useQuery({
    queryKey: ['mentionable-users', recruitId],
    queryFn: async () => {
      // If recruitId provided, use the assignable users edge function for filtered list
      if (recruitId) {
        const { data, error } = await supabase.functions.invoke('fetch-assignable-users', {
          body: { recruitId }
        });
        
        if (error) {
          console.error('Error fetching assignable users for mentions:', error);
          // Fall back to all reps
          const { data: reps, error: repsError } = await supabase
            .from('reps')
            .select('user_id, name, profile_photo_url')
            .not('user_id', 'is', null)
            .order('name');
          if (repsError) throw repsError;
          return (reps || []).filter(r => r.user_id) as MentionUser[];
        }
        
        // Map assignable users to MentionUser format
        const assignableUsers = data?.assignableUsers || [];
        
        // Also get the profile photos for these users
        const userIds = assignableUsers.map((u: any) => u.userId).filter(Boolean);
        if (userIds.length === 0) return [];
        
        const { data: reps } = await supabase
          .from('reps')
          .select('user_id, name, profile_photo_url')
          .in('user_id', userIds);
        
        const photoMap = new Map((reps || []).map(r => [r.user_id, r.profile_photo_url]));
        
        return assignableUsers.map((u: any) => ({
          user_id: u.userId,
          name: u.name,
          profile_photo_url: photoMap.get(u.userId) || null,
        })) as MentionUser[];
      }
      
      // Default: fetch all reps
      const { data, error } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .not('user_id', 'is', null)
        .order('name');
      
      if (error) throw error;
      return (data || []).filter(r => r.user_id) as MentionUser[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Parse @mentions from text and return user IDs - only for confirmed mentions
export const parseMentions = (text: string, users: MentionUser[]): string[] => {
  const mentionPattern = /@(\w+(?:\s+\w+)?)/g;
  const matches = text.match(mentionPattern) || [];
  
  const mentionedUserIds: string[] = [];
  
  for (const match of matches) {
    const mentionName = match.slice(1).toLowerCase(); // Remove @ and lowercase
    
    // Find user by first name or full name match
    const user = users.find(u => {
      const firstName = u.name.split(' ')[0].toLowerCase();
      const fullName = u.name.toLowerCase().replace(/\s+/g, ' ');
      return firstName === mentionName || fullName.startsWith(mentionName);
    });
    
    if (user && !mentionedUserIds.includes(user.user_id)) {
      mentionedUserIds.push(user.user_id);
    }
  }
  
  return mentionedUserIds;
};

export const MentionInput = ({
  value,
  onChange,
  onMentionsChange,
  placeholder = "Add a comment...",
  className,
  autoFocus = false,
  rows = 2,
  recruitId,
}: MentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: users = [] } = useMentionableUsers(recruitId);
  const { userId: currentUserId } = useCurrentUserId();
  
  // Filter users based on query - exclude current user
  const filteredUsers = useMemo(() => {
    if (!suggestionQuery && !showSuggestions) return [];
    
    return users
      .filter(u => 
        u.user_id !== currentUserId && // Exclude self
        u.name.toLowerCase().includes(suggestionQuery.toLowerCase())
      )
      .slice(0, 6);
  }, [suggestionQuery, showSuggestions, users, currentUserId]);
  
  // Parse mentions from current value
  const mentionedUserIds = useMemo(() => {
    return parseMentions(value, users);
  }, [value, users]);
  
  // Notify parent of mentions
  useEffect(() => {
    onMentionsChange(mentionedUserIds);
  }, [mentionedUserIds, onMentionsChange]);
  
  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [filteredUsers.length]);
  
  // Auto focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);
  
  // Handle input changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(newCursorPos);
    
    // Check if we're typing after an @
    const textBeforeCursor = newValue.slice(0, newCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      const hasNewline = textAfterAt.includes('\n');
      const hasDoubleSpace = textAfterAt.includes('  ');
      
      // Show suggestions if we're right after @ or typing a name
      if (!hasNewline && !hasDoubleSpace && textAfterAt.length < 20) {
        setSuggestionQuery(textAfterAt);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [onChange]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedUser = filteredUsers[selectedSuggestionIndex];
        if (selectedUser) {
          selectUser(selectedUser);
        }
        return;
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const selectedUser = filteredUsers[selectedSuggestionIndex];
        if (selectedUser) {
          selectUser(selectedUser);
        }
        return;
      }
    }
  };
  
  // Handle user selection from suggestions
  const selectUser = useCallback((user: MentionUser) => {
    if (!textareaRef.current) return;
    
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const firstName = user.name.split(' ')[0];
      const newText = textBeforeCursor.slice(0, atIndex) + `@${firstName} ` + textAfterCursor;
      const newCursorPos = atIndex + firstName.length + 2; // @ + name + space
      
      onChange(newText);
      setCursorPosition(newCursorPos);
      
      // Set cursor position after React updates
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    
    setShowSuggestions(false);
    setSuggestionQuery("");
  }, [value, cursorPosition, onChange]);
  
  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Track cursor position on selection changes
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  }, []);
  
  // Calculate min height based on rows
  const minHeight = rows * 24 + 16; // 24px per row + padding
  
  // Render the value with highlighted mentions for the overlay
  const renderHighlightedText = () => {
    if (!value) return null;
    
    const mentionPattern = /@(\w+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = mentionPattern.exec(value)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {value.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      const mentionName = match[1];
      const matchedUser = users.find(u => 
        u.name.split(' ')[0].toLowerCase() === mentionName.toLowerCase()
      );
      
      if (matchedUser) {
        // Highlighted mention
        parts.push(
          <span key={`mention-${match.index}`} className="text-cyan-500 font-semibold">
            @{mentionName}
          </span>
        );
      } else {
        // Non-matched @ text
        parts.push(
          <span key={`text-${match.index}`}>
            {match[0]}
          </span>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(
        <span key={`text-end-${lastIndex}`}>
          {value.slice(lastIndex)}
        </span>
      );
    }
    
    return parts;
  };
  
  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Highlight layer - renders colored mentions behind textarea */}
      <div 
        className={cn(
          "absolute inset-0 pointer-events-none rounded-md border border-transparent px-3 py-2 text-sm overflow-hidden whitespace-pre-wrap break-words",
          className
        )}
        style={{ minHeight: `${minHeight}px` }}
        aria-hidden="true"
      >
        {renderHighlightedText()}
      </div>
      
      {/* Actual textarea - transparent text so highlights show through */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          // Make text visible but mentions will appear highlighted due to overlay
          "text-foreground caret-foreground",
          className
        )}
        style={{ 
          minHeight: `${minHeight}px`,
          // Use caretColor to make cursor visible, keep text visible too
          WebkitTextFillColor: 'currentcolor',
        }}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border rounded-lg shadow-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto">
          <div className="px-2 py-1.5 border-b bg-muted/30">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Mention someone
            </span>
          </div>
          {filteredUsers.map((user, index) => (
            <button
              key={user.user_id}
              type="button"
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left",
                index === selectedSuggestionIndex 
                  ? "bg-primary/10" 
                  : "active:bg-muted"
              )}
              onClick={() => selectUser(user)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profile_photo_url || undefined} alt={user.name} />
                <AvatarFallback className="text-xs bg-muted">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{user.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  @{user.name.split(' ')[0].toLowerCase()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Empty state when typing @ but no matches */}
      {showSuggestions && filteredUsers.length === 0 && suggestionQuery && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border rounded-lg shadow-lg overflow-hidden z-50 p-3">
          <p className="text-xs text-muted-foreground text-center">
            No users found matching "@{suggestionQuery}"
          </p>
        </div>
      )}
    </div>
  );
};

// Render text with highlighted mentions (for display in comments)
export const MentionText = ({ text, className }: { text: string; className?: string }) => {
  const mentionPattern = /@(\w+)/g;
  const parts = text.split(mentionPattern);
  
  return (
    <span className={className}>
      {parts.map((part, i) => {
        // Every odd index is a mention (captured group)
        if (i % 2 === 1) {
          return (
            <span key={i} className="text-cyan-500 font-semibold">
              @{part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
};
