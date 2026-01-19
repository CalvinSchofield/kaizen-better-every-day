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

// Get plain text from contenteditable element
const getPlainTextFromElement = (element: HTMLElement): string => {
  let text = '';
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        text += '\n';
      } else if (el.dataset.mentionName) {
        // This is a mention span
        text += `@${el.dataset.mentionName}`;
      } else {
        text += getPlainTextFromElement(el);
      }
    }
  });
  return text;
};

// Get cursor position in plain text
const getCursorPositionInPlainText = (element: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  
  // Count text up to cursor
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(preCaretRange.cloneContents());
  return getPlainTextFromElement(tempDiv).length;
};

// Set cursor position in contenteditable
const setCursorPosition = (element: HTMLElement, position: number): void => {
  const selection = window.getSelection();
  if (!selection) return;
  
  let currentPos = 0;
  let targetNode: Node | null = null;
  let targetOffset = 0;
  
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = (node.textContent || '').length;
      if (currentPos + textLength >= position) {
        targetNode = node;
        targetOffset = position - currentPos;
        return true;
      }
      currentPos += textLength;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        if (currentPos === position) {
          targetNode = node;
          targetOffset = 0;
          return true;
        }
        currentPos += 1;
      } else if (el.dataset.mentionName) {
        const mentionLength = el.dataset.mentionName.length + 1; // +1 for @
        if (currentPos + mentionLength >= position) {
          // Put cursor after the mention span
          targetNode = el.nextSibling || el.parentNode;
          targetOffset = 0;
          return true;
        }
        currentPos += mentionLength;
      } else {
        for (const child of Array.from(node.childNodes)) {
          if (walk(child)) return true;
        }
      }
    }
    return false;
  };
  
  walk(element);
  
  if (targetNode) {
    const range = document.createRange();
    try {
      range.setStart(targetNode, targetOffset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      // Fallback: set cursor at end
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
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
  const [confirmedMentions, setConfirmedMentions] = useState<ConfirmedMention[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
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
  
  // Sync external value changes to editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    const currentText = getPlainTextFromElement(editorRef.current);
    if (currentText !== value) {
      // Value changed externally, rebuild the editor content
      if (!value) {
        editorRef.current.innerHTML = '';
        setConfirmedMentions([]);
      } else {
        // Rebuild with mentions highlighted
        rebuildEditorContent(value);
      }
    }
  }, [value]);
  
  // Rebuild editor content with mention highlighting
  const rebuildEditorContent = useCallback((text: string) => {
    if (!editorRef.current) return;
    
    // Find all @mentions in text
    const mentionPattern = /@(\w+)/g;
    let match;
    const newMentions: ConfirmedMention[] = [];
    let html = '';
    let lastIndex = 0;
    
    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1];
      const matchedUser = users.find(u => 
        u.name.split(' ')[0].toLowerCase() === mentionName.toLowerCase()
      );
      
      // Add text before mention
      const textBefore = text.slice(lastIndex, match.index);
      html += escapeHtml(textBefore).replace(/\n/g, '<br>');
      
      if (matchedUser) {
        // Add highlighted mention
        html += `<span class="text-primary font-medium" data-mention-name="${mentionName}" data-mention-user-id="${matchedUser.user_id}" contenteditable="false">@${mentionName}</span>`;
        newMentions.push({
          userId: matchedUser.user_id,
          name: mentionName,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      } else {
        // No matched user, just add as plain text
        html += escapeHtml(match[0]);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    html += escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
    
    editorRef.current.innerHTML = html || '';
    setConfirmedMentions(newMentions);
    onMentionsChange(newMentions.map(m => m.userId));
  }, [users, onMentionsChange]);
  
  // Escape HTML special characters
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // Handle input changes
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    
    const plainText = getPlainTextFromElement(editorRef.current);
    const cursorPos = getCursorPositionInPlainText(editorRef.current);
    
    onChange(plainText);
    
    // Update confirmed mentions based on new text
    const validMentions = confirmedMentions.filter(m => {
      const mentionText = `@${m.name}`;
      return plainText.includes(mentionText);
    });
    
    if (validMentions.length !== confirmedMentions.length) {
      setConfirmedMentions(validMentions);
      onMentionsChange(validMentions.map(m => m.userId));
    }
    
    // Check if we're typing after an @
    const textBeforeCursor = plainText.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      const hasNewline = textAfterAt.includes('\n');
      const hasSpace = textAfterAt.includes(' ');
      
      // Check if this @ is already a confirmed mention
      const isConfirmed = validMentions.some(m => {
        const mentionText = `@${m.name}`;
        const mentionStart = plainText.indexOf(mentionText);
        return mentionStart === atIndex;
      });
      
      if (!isConfirmed && !hasSpace && !hasNewline) {
        setSuggestionQuery(textAfterAt);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [confirmedMentions, onChange, onMentionsChange]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
    if (!editorRef.current) return;
    
    const plainText = getPlainTextFromElement(editorRef.current);
    const cursorPos = getCursorPositionInPlainText(editorRef.current);
    const textBeforeCursor = plainText.slice(0, cursorPos);
    const textAfterCursor = plainText.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const firstName = user.name.split(' ')[0];
      const newText = textBeforeCursor.slice(0, atIndex) + `@${firstName} ` + textAfterCursor;
      
      // Update the editor content with the new mention
      onChange(newText);
      
      // Rebuild editor with highlighting
      setTimeout(() => {
        rebuildEditorContent(newText);
        
        // Set cursor after the mention
        if (editorRef.current) {
          const newCursorPos = atIndex + firstName.length + 2; // @ + name + space
          setCursorPosition(editorRef.current, newCursorPos);
          editorRef.current.focus();
        }
      }, 0);
    }
    
    setShowSuggestions(false);
    setSuggestionQuery("");
  }, [onChange, rebuildEditorContent]);
  
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
  
  // Auto focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);
  
  // Calculate min height based on rows
  const minHeight = rows * 24 + 16; // 24px per row + padding
  
  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Contenteditable div for rich text with mention highlighting */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 overflow-auto whitespace-pre-wrap break-words",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          className
        )}
        style={{ minHeight: `${minHeight}px` }}
      />
      
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
