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
  const [cursorPosition, setCursorPosition] = useState(0);
  const [confirmedMentions, setConfirmedMentions] = useState<ConfirmedMention[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
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
  
  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [filteredUsers.length]);
  
  // Update confirmed mentions when value changes externally (e.g., cleared)
  useEffect(() => {
    if (!value) {
      setConfirmedMentions([]);
    }
  }, [value]);
  
  // Find mentions in text and update state
  const updateConfirmedMentions = useCallback((text: string, mentions: ConfirmedMention[]) => {
    // Validate that all confirmed mentions still exist in the text
    const validMentions = mentions.filter(m => {
      const mentionText = `@${m.name}`;
      const indexInText = text.indexOf(mentionText);
      return indexInText !== -1;
    });
    
    // Re-calculate positions for valid mentions
    const updatedMentions = validMentions.map(m => {
      const mentionText = `@${m.name}`;
      const startIndex = text.indexOf(mentionText);
      return {
        ...m,
        startIndex,
        endIndex: startIndex + mentionText.length,
      };
    });
    
    setConfirmedMentions(updatedMentions);
    onMentionsChange(updatedMentions.map(m => m.userId));
  }, [onMentionsChange]);
  
  // Check for @ trigger - works with textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursor);
    
    // Update confirmed mentions based on new text
    updateConfirmedMentions(newValue, confirmedMentions);
    
    // Check if we're typing after an @
    const textBeforeCursor = newValue.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // Check if there's a newline between @ and cursor
      const hasNewline = textAfterAt.includes('\n');
      // Check if this @ is already a confirmed mention
      const isConfirmed = confirmedMentions.some(m => 
        m.startIndex === atIndex && newValue.slice(atIndex, m.endIndex) === `@${m.name}`
      );
      
      if (!isConfirmed && !textAfterAt.includes(' ') && !hasNewline) {
        // Only trigger if not confirmed, no space, and no newline
        setSuggestionQuery(textAfterAt);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };
  
  // Handle keyboard navigation - for both desktop and mobile
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredUsers.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < filteredUsers.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : filteredUsers.length - 1
      );
    } else if (e.key === 'Enter' && showSuggestions) {
      e.preventDefault();
      const selectedUser = filteredUsers[selectedSuggestionIndex];
      if (selectedUser) {
        selectUser(selectedUser);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };
  
  // Handle user selection from suggestions
  const selectUser = useCallback((user: MentionUser) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const firstName = user.name.split(' ')[0];
      const mentionText = `@${firstName}`;
      const newValue = textBeforeCursor.slice(0, atIndex) + mentionText + ' ' + textAfterCursor;
      
      // Add to confirmed mentions
      const newMention: ConfirmedMention = {
        userId: user.user_id,
        name: firstName,
        startIndex: atIndex,
        endIndex: atIndex + mentionText.length,
      };
      
      const updatedMentions = [...confirmedMentions, newMention];
      setConfirmedMentions(updatedMentions);
      onMentionsChange(updatedMentions.map(m => m.userId));
      
      onChange(newValue);
    }
    
    setShowSuggestions(false);
    setSuggestionQuery("");
    
    // Focus back and set cursor position after the mention
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [value, cursorPosition, confirmedMentions, onChange, onMentionsChange]);
  
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
  
  // Note: We use a simple approach - text displays normally in the textarea
  // The @mention badge shows how many mentions are confirmed
  
  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Standard textarea - no overlay tricks, just plain text */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={rows}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
      />
      
      {/* Show confirmed mentions count badge */}
      {confirmedMentions.length > 0 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
          <span>@{confirmedMentions.length}</span>
        </div>
      )}
      
      {/* Mention Suggestions Dropdown - Instagram style */}
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
                  : "hover:bg-muted"
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
            <span key={i} className="text-primary font-medium">
              @{part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
};
