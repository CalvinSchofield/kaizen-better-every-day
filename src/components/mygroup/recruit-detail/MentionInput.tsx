import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

interface MentionUser {
  user_id: string;
  name: string;
  profile_photo_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange: (userIds: string[]) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

// Hook to get mentionable users (team members)
export const useMentionableUsers = () => {
  return useQuery({
    queryKey: ['mentionable-users'],
    queryFn: async () => {
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

// Parse @mentions from text and return user IDs
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
}: MentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: users = [] } = useMentionableUsers();
  
  // Filter users based on query
  const filteredUsers = suggestionQuery
    ? users.filter(u => 
        u.name.toLowerCase().includes(suggestionQuery.toLowerCase())
      ).slice(0, 5)
    : [];
  
  // Check for @ trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursor);
    
    // Check if we're typing after an @
    const textBeforeCursor = newValue.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // Only show suggestions if we're right after @ or typing a name
      if (!textAfterAt.includes(' ') || textAfterAt.split(' ').length <= 2) {
        setSuggestionQuery(textAfterAt);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
    
    // Update mentions
    const mentionedIds = parseMentions(newValue, users);
    onMentionsChange(mentionedIds);
  };
  
  // Handle user selection from suggestions
  const selectUser = useCallback((user: MentionUser) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const firstName = user.name.split(' ')[0];
      const newValue = textBeforeCursor.slice(0, atIndex) + '@' + firstName + ' ' + textAfterCursor;
      onChange(newValue);
      
      // Update mentions
      const mentionedIds = parseMentions(newValue, users);
      onMentionsChange(mentionedIds);
    }
    
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [value, cursorPosition, users, onChange, onMentionsChange]);
  
  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={cn("pr-10", className)}
        autoFocus={autoFocus}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border rounded-lg shadow-lg overflow-hidden z-50">
          {filteredUsers.map(user => (
            <button
              key={user.user_id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
              onClick={() => selectUser(user)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.profile_photo_url || undefined} alt={user.name} />
                <AvatarFallback className="text-[10px] bg-muted">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{user.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Render text with highlighted mentions
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
