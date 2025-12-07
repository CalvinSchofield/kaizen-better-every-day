import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Calendar, 
  Plane, 
  Target,
  Plus,
  Minus,
  Check,
  ChevronRight,
  X
} from "lucide-react";
import { RepGoals } from "@/hooks/useRepGoals";
import { cn } from "@/lib/utils";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useRepData } from "@/hooks/useRepData";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Books list - synced with BooksSection
const BOOKS = [
  { id: "compound-effect", title: "The Compound Effect", author: "Darren Hardy" },
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear" },
  { id: "go-for-no", title: "Go for No!", author: "Richard Fenton & Andrea Waltz" },
  { id: "miracle-morning", title: "The Miracle Morning", author: "Hal Elrod" },
  { id: "10x-rule", title: "The 10X Rule", author: "Grant Cardone" },
  { id: "d2d-millionaire", title: "Door to Door Millionaire", author: "Lenny Gray" },
  { id: "happiness-advantage", title: "The Happiness Advantage", author: "Shawn Achor" },
  { id: "thinking-big", title: "The Magic of Thinking Big", author: "David Schwartz" },
  { id: "never-split", title: "Never Split the Difference", author: "Chris Voss" },
  { id: "extreme-ownership", title: "Extreme Ownership", author: "Jocko Willink & Leif Babin" },
  { id: "power-one-more", title: "The Power of One More", author: "Ed Mylett" },
  { id: "abcs-closing", title: "ABC'$ of Closing", author: "Sam Taggart" },
  { id: "man-thinketh", title: "As a Man Thinketh", author: "James Allen" },
  { id: "psychology-selling", title: "The Psychology of Selling", author: "Brian Tracy" },
  { id: "above-line", title: "Above the Line", author: "Urban Meyer" },
  { id: "win-friends", title: "How to Win Friends and Influence People", author: "Dale Carnegie" },
  { id: "success-habits", title: "Millionaire Success Habits", author: "Dean Graziosi" },
  { id: "one-thing", title: "The One Thing", author: "Gary Keller" },
  { id: "cant-hurt-me", title: "Can't Hurt Me", author: "David Goggins" },
];

const BOOKS_READ_KEY = "kaizen-books-read";
const OTHER_BOOKS_KEY = "kaizen-other-books";

interface CommitmentEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: RepGoals;
  onUpdateGoals: (updates: Partial<RepGoals>) => Promise<unknown>;
  isUpdating?: boolean;
  preseasonFpProgress: number;
}

interface CommittedBlitz {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  location?: string;
}

interface CommitmentConfig {
  key: string;
  progressKey: string;
  label: string;
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  description: string;
  incrementBy: number;
  maxValue?: number;
}

const commitmentConfigs: CommitmentConfig[] = [
  {
    key: 'preseason_fp_goal',
    progressKey: 'preseason_fp_progress',
    label: 'Before Summer',
    icon: Target,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: 'FP+ goal before summer starts',
    incrementBy: 1,
  },
  {
    key: 'training_hours_goal',
    progressKey: 'training_hours_progress',
    label: 'Training Hours',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'Weekly training goal (resets Sunday)',
    incrementBy: 15, // minutes
  },
  {
    key: 'role_plays_goal',
    progressKey: 'role_plays_progress',
    label: 'Role Plays',
    icon: Users,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    description: 'Practice with vets',
    incrementBy: 1,
  },
  {
    key: 'monday_night_lights_goal',
    progressKey: 'monday_night_lights_progress',
    label: 'Monday Night Lights',
    icon: Calendar,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    description: 'Weekly team calls',
    incrementBy: 1,
  },
];

export const CommitmentEditorDrawer = ({
  open,
  onOpenChange,
  goals,
  onUpdateGoals,
  isUpdating = false,
  preseasonFpProgress,
}: CommitmentEditorDrawerProps) => {
  const { efpModeEnabled } = useEfpMode();
  const { allBlitzes } = useBlitzes();
  const { repData } = useRepData();
  const queryClient = useQueryClient();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
  
  const [editingGoals, setEditingGoals] = useState<Record<string, number>>({});
  const [isBlitzExpanded, setIsBlitzExpanded] = useState(false);
  const [isBooksExpanded, setIsBooksExpanded] = useState(false);
  const [isCommitting, setIsCommitting] = useState<string | null>(null);
  const [booksRead, setBooksRead] = useState<Set<string>>(new Set());
  const [otherBooks, setOtherBooks] = useState<string[]>([]);
  const [newOtherBook, setNewOtherBook] = useState("");

  // Load books from localStorage on mount
  useEffect(() => {
    try {
      const storedBooks = localStorage.getItem(BOOKS_READ_KEY);
      if (storedBooks) {
        setBooksRead(new Set(JSON.parse(storedBooks)));
      }
      const storedOther = localStorage.getItem(OTHER_BOOKS_KEY);
      if (storedOther) {
        setOtherBooks(JSON.parse(storedOther));
      }
    } catch {
      // Ignore parse errors
    }
  }, [open]);

  const totalBooksRead = booksRead.size + otherBooks.length;

  // Get committed blitzes
  const committedBlitzes = useMemo(() => {
    return (repData?.committed_blitzes as CommittedBlitz[]) || [];
  }, [repData?.committed_blitzes]);

  // Future available blitzes
  const futureAvailableBlitzes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allBlitzes.filter(blitz => {
      const blitzStart = new Date(blitz.date);
      blitzStart.setHours(0, 0, 0, 0);
      return blitzStart >= today;
    });
  }, [allBlitzes]);

  // Blitz stats
  const blitzStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attended = 0;
    committedBlitzes.forEach(blitz => {
      const blitzEnd = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
      blitzEnd.setHours(23, 59, 59, 999);
      if (blitzEnd < today) attended++;
    });
    
    return {
      attended,
      committed: committedBlitzes.length,
      available: futureAvailableBlitzes.length,
    };
  }, [committedBlitzes, futureAvailableBlitzes]);

  const handleStepperChange = (key: string, delta: number, maxValue?: number) => {
    const currentValue = editingGoals[key] ?? (Number(goals[key as keyof RepGoals]) || 0);
    let newValue = Math.max(0, currentValue + delta);
    if (maxValue !== undefined) {
      newValue = Math.min(newValue, maxValue);
    }
    setEditingGoals(prev => ({ ...prev, [key]: newValue }));
  };

  const handleSaveGoals = async () => {
    if (Object.keys(editingGoals).length === 0) {
      onOpenChange(false);
      return;
    }
    
    await onUpdateGoals(editingGoals);
    setEditingGoals({});
    onOpenChange(false);
    toast.success("Standards saved!");
  };

  const handleCommitToBlitz = async (blitz: { id: string; name: string; date: string; endDate?: string | null; location?: string | null }) => {
    if (!repData?.id) return;
    setIsCommitting(blitz.id);
    
    try {
      const newCommitment: CommittedBlitz = {
        id: blitz.id,
        name: blitz.name,
        date: blitz.date,
        endDate: blitz.endDate || undefined,
        location: blitz.location || undefined,
      };
      
      const updatedCommitments = [...committedBlitzes, newCommitment];
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(['rep-data'], (old: typeof repData) => {
        if (!old) return old;
        return { ...old, committed_blitzes: updatedCommitments };
      });
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: updatedCommitments as unknown as null })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Invalidate planned days to trigger calendar update
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
      toast.success(`Committed to ${blitz.name}!`);
    } catch (error) {
      console.error('Error committing to blitz:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toast.error("Failed to commit to blitz");
    } finally {
      setIsCommitting(null);
    }
  };

  const handleUncommitFromBlitz = async (blitzId: string) => {
    if (!repData?.id) return;
    setIsCommitting(blitzId);
    
    try {
      const updatedCommitments = committedBlitzes.filter(b => b.id !== blitzId);
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(['rep-data'], (old: typeof repData) => {
        if (!old) return old;
        return { ...old, committed_blitzes: updatedCommitments };
      });
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: updatedCommitments as unknown as null })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Invalidate planned days to trigger calendar update
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
      toast.success("Uncommitted from blitz");
    } catch (error) {
      console.error('Error uncommitting from blitz:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toast.error("Failed to uncommit");
    } finally {
      setIsCommitting(null);
    }
  };

  const handleBookToggle = async (bookId: string) => {
    const newBooksRead = new Set(booksRead);
    
    if (newBooksRead.has(bookId)) {
      newBooksRead.delete(bookId);
    } else {
      newBooksRead.add(bookId);
    }
    
    setBooksRead(newBooksRead);
    localStorage.setItem(BOOKS_READ_KEY, JSON.stringify([...newBooksRead]));
    
    const newCount = newBooksRead.size + otherBooks.length;
    try {
      await onUpdateGoals({ books_progress: newCount });
      if (newBooksRead.has(bookId)) {
        const book = BOOKS.find(b => b.id === bookId);
        toast.success(`"${book?.title}" marked as read!`);
      }
    } catch (error) {
      toast.error("Failed to update progress");
    }
  };

  const handleAddOtherBook = async () => {
    if (!newOtherBook.trim()) return;
    
    const updatedOther = [...otherBooks, newOtherBook.trim()];
    setOtherBooks(updatedOther);
    localStorage.setItem(OTHER_BOOKS_KEY, JSON.stringify(updatedOther));
    setNewOtherBook("");
    
    const newCount = booksRead.size + updatedOther.length;
    try {
      await onUpdateGoals({ books_progress: newCount });
      toast.success(`"${newOtherBook.trim()}" added!`);
    } catch (error) {
      toast.error("Failed to update progress");
    }
  };

  const handleRemoveOtherBook = async (index: number) => {
    const bookName = otherBooks[index];
    const updatedOther = otherBooks.filter((_, i) => i !== index);
    setOtherBooks(updatedOther);
    localStorage.setItem(OTHER_BOOKS_KEY, JSON.stringify(updatedOther));
    
    const newCount = booksRead.size + updatedOther.length;
    try {
      await onUpdateGoals({ books_progress: newCount });
      toast.success(`"${bookName}" removed`);
    } catch (error) {
      toast.error("Failed to update progress");
    }
  };

  const formatDisplayValue = (key: string, value: number) => {
    if (key === 'training_hours_goal') {
      if (value >= 60) {
        const hours = Math.floor(value / 60);
        const mins = value % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
      return `${value}m`;
    }
    if (key === 'preseason_fp_goal') {
      return `${value} ${metricLabel}`;
    }
    return value.toString();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle>Set Your Standards</DrawerTitle>
          <DrawerDescription>
            What are you committing to this preseason?
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-3 overflow-y-auto max-h-[70vh]">
          {/* Blitzes Section */}
          <div className="rounded-xl p-4 bg-red-500/10">
            <button 
              className="flex items-center gap-3 w-full text-left"
              onClick={() => setIsBlitzExpanded(!isBlitzExpanded)}
            >
              <div className="p-2 rounded-lg bg-background/60">
                <Plane className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Blitzes</p>
                <p className="text-xs text-muted-foreground">
                  {blitzStats.attended > 0 && `${blitzStats.attended} attended · `}
                  {blitzStats.committed} committed · {blitzStats.available} available
                </p>
              </div>
              <span className="text-2xl font-bold tabular-nums mr-2">{blitzStats.committed}</span>
              <ChevronRight className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isBlitzExpanded && "rotate-90"
              )} />
            </button>
            
            {isBlitzExpanded && (
              <div className="space-y-2 mt-3">
                {futureAvailableBlitzes.map((blitz) => {
                  const isCommitted = committedBlitzes.some(b => b.id === blitz.id);
                  const blitzDate = new Date(blitz.date);
                  
                  return (
                    <div 
                      key={blitz.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-all",
                        isCommitted ? "bg-green-500/20 ring-1 ring-green-500/50" : "bg-background/50"
                      )}
                    >
                      <div>
                        <p className="font-medium text-sm">{blitz.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {blitzDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {blitz.location && ` · ${blitz.location}`}
                        </p>
                      </div>
                      <Button
                        variant={isCommitted ? "outline" : "default"}
                        size="sm"
                        onClick={() => isCommitted 
                          ? handleUncommitFromBlitz(blitz.id)
                          : handleCommitToBlitz(blitz)
                        }
                        disabled={isCommitting === blitz.id}
                        className={cn(
                          "min-w-[80px]",
                          isCommitted && "border-green-500/50 text-green-600"
                        )}
                      >
                        {isCommitting === blitz.id ? "..." : isCommitted ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Going
                          </>
                        ) : "Commit"}
                      </Button>
                    </div>
                  );
                })}
                
                {futureAvailableBlitzes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No upcoming blitzes scheduled
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Books Section - Expandable */}
          <div className="rounded-xl p-4 bg-purple-500/10">
            <button 
              className="flex items-center gap-3 w-full text-left"
              onClick={() => setIsBooksExpanded(!isBooksExpanded)}
            >
              <div className="p-2 rounded-lg bg-background/60">
                <BookOpen className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Books Read</p>
                <p className="text-xs text-muted-foreground">
                  {totalBooksRead} of {BOOKS.length}+ available
                </p>
              </div>
              <span className="text-2xl font-bold tabular-nums mr-2">{totalBooksRead}</span>
              <ChevronRight className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isBooksExpanded && "rotate-90"
              )} />
            </button>
            
            {isBooksExpanded && (
              <div className="space-y-2 mt-3 max-h-64 overflow-y-auto">
                {BOOKS.map((book) => {
                  const isRead = booksRead.has(book.id);
                  
                  return (
                    <div 
                      key={book.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-all",
                        isRead ? "bg-green-500/20" : "bg-background/50"
                      )}
                    >
                      <Checkbox
                        id={`drawer-${book.id}`}
                        checked={isRead}
                        onCheckedChange={() => handleBookToggle(book.id)}
                        disabled={isUpdating}
                      />
                      <label 
                        htmlFor={`drawer-${book.id}`}
                        className={cn(
                          "flex-1 cursor-pointer",
                          isRead && "line-through text-muted-foreground"
                        )}
                      >
                        <p className="font-medium text-sm">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                      </label>
                      {isRead && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    </div>
                  );
                })}
                
                {/* Other books */}
                {otherBooks.map((bookName, index) => (
                  <div 
                    key={`other-${index}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-green-500/20"
                  >
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm line-through text-muted-foreground">{bookName}</p>
                      <p className="text-xs text-muted-foreground">Other book</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveOtherBook(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                
                {/* Add other book input */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                  <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Add another book..."
                    value={newOtherBook}
                    onChange={(e) => setNewOtherBook(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOtherBook()}
                    className="h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddOtherBook}
                    disabled={!newOtherBook.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Other commitments with steppers */}
          {commitmentConfigs.map((config) => {
            const Icon = config.icon;
            const isTraining = config.key === 'training_hours_goal';
            const isPreseasonFp = config.key === 'preseason_fp_goal';
            const currentValue = editingGoals[config.key] ?? (Number(goals[config.key as keyof RepGoals]) || 0);
            const stepAmount = isTraining ? 15 : config.incrementBy;
            const displayValue = formatDisplayValue(config.key, currentValue);
            
            // Dynamic description for preseason FP goal based on mode
            const description = isPreseasonFp 
              ? `${metricLabel} goal before summer starts`
              : config.description;

            return (
              <div 
                key={config.key} 
                className={cn("rounded-xl p-4 transition-all", config.bgColor)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background/60">
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Stepper */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => handleStepperChange(config.key, -stepAmount, config.maxValue)}
                      disabled={currentValue <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="text-center min-w-[56px]">
                      <span className="text-lg font-bold tabular-nums">
                        {displayValue}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => handleStepperChange(config.key, stepAmount, config.maxValue)}
                      disabled={config.maxValue !== undefined && currentValue >= config.maxValue}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          <Button 
            onClick={handleSaveGoals} 
            className="w-full mt-4"
            disabled={isUpdating}
            size="lg"
          >
            {isUpdating ? "Saving..." : "Save Standards"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
