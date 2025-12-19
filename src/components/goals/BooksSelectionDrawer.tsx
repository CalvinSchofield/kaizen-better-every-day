import { useState } from "react";
import { BookOpen, Check, Plus, X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import confetti from "canvas-confetti";
import { useSyncedBooks } from "@/hooks/useSyncedBooks";

interface Book {
  id: string;
  title: string;
  author: string;
}

export const BOOKS: Book[] = [
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
  { id: "abcs-closing", title: "ABC's of Closing", author: "Sam Taggart" },
  { id: "man-thinketh", title: "As a Man Thinketh", author: "James Allen" },
  { id: "psychology-selling", title: "The Psychology of Selling", author: "Brian Tracy" },
  { id: "above-line", title: "Above the Line", author: "Urban Meyer" },
  { id: "win-friends", title: "How to Win Friends and Influence People", author: "Dale Carnegie" },
  { id: "success-habits", title: "Millionaire Success Habits", author: "Dean Graziosi" },
  { id: "one-thing", title: "The One Thing", author: "Gary Keller" },
  { id: "cant-hurt-me", title: "Can't Hurt Me", author: "David Goggins" },
];

// Legacy keys kept for reference during migration
export const BOOKS_COMMITTED_KEY = "kaizen-books-committed";
export const BOOKS_READ_KEY = "kaizen-books-read";
export const OTHER_BOOKS_COMMITTED_KEY = "kaizen-other-books-committed";
export const OTHER_BOOKS_READ_KEY = "kaizen-other-books-read";

// Drawer for SELECTING books to commit to (goal setting)
interface BooksCommitmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateGoal: (newGoal: number) => Promise<unknown>;
}

export const BooksCommitmentDrawer = ({
  isOpen,
  onClose,
  onUpdateGoal,
}: BooksCommitmentDrawerProps) => {
  const { toast } = useToast();
  const {
    booksCommitted,
    otherBooksCommitted,
    toggleBookCommitted,
    addOtherBookCommitted,
    removeOtherBookCommitted,
    isLoading,
  } = useSyncedBooks();
  const [newOtherBook, setNewOtherBook] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleBookToggle = async (bookId: string) => {
    setIsSaving(true);
    try {
      await toggleBookCommitted(bookId);
      const newCount = (booksCommitted.has(bookId) 
        ? booksCommitted.size - 1 
        : booksCommitted.size + 1) + otherBooksCommitted.length;
      await onUpdateGoal(newCount);
    } catch {
      toast({
        title: "Error saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOtherBook = async () => {
    if (!newOtherBook.trim()) return;
    
    setIsSaving(true);
    try {
      await addOtherBookCommitted(newOtherBook.trim());
      const newCount = booksCommitted.size + otherBooksCommitted.length + 1;
      await onUpdateGoal(newCount);
      setNewOtherBook("");
    } catch {
      toast({
        title: "Error saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveOtherBook = async (index: number) => {
    setIsSaving(true);
    try {
      await removeOtherBookCommitted(index);
      const newCount = booksCommitted.size + otherBooksCommitted.length - 1;
      await onUpdateGoal(newCount);
    } catch {
      toast({
        title: "Error saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalCommitted = booksCommitted.size + otherBooksCommitted.length;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="flex items-center justify-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-500" />
            Books to Read
          </DrawerTitle>
          <DrawerDescription>
            {totalCommitted} book{totalCommitted !== 1 ? 's' : ''} committed
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60dvh] flex-1 min-h-0">
          {/* Recommended Books */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Recommended Books</h4>
            {BOOKS.map((book) => {
              const isCommitted = booksCommitted.has(book.id);
              return (
                <button
                  key={book.id}
                  onClick={() => handleBookToggle(book.id)}
                  disabled={isSaving || isLoading}
                  className={cn(
                    "flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all",
                    isCommitted ? "bg-purple-500/10 ring-1 ring-purple-500/50" : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <Checkbox checked={isCommitted} className="pointer-events-none" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                  </div>
                  {isCommitted && <Check className="h-4 w-4 text-purple-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Other Books */}
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Add Your Own</h4>
            
            {otherBooksCommitted.map((book, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 ring-1 ring-purple-500/50"
              >
                <Check className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span className="flex-1 text-sm">{book}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveOtherBook(index)}
                  disabled={isSaving || isLoading}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            
            <div className="flex gap-2">
              <Input
                placeholder="Add another book..."
                value={newOtherBook}
                onChange={(e) => setNewOtherBook(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddOtherBook()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddOtherBook}
                disabled={!newOtherBook.trim() || isSaving || isLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6">
          <Button
            onClick={onClose}
            className="w-full"
            size="lg"
          >
            Done
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// Drawer for MARKING committed books as READ (progress tracking)
interface BooksCompletionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentProgress: number;
  onUpdateProgress: (newProgress: number) => Promise<unknown>;
  onOpenCommitmentEditor?: () => void;
}

export const BooksCompletionDrawer = ({
  isOpen,
  onClose,
  currentProgress,
  onUpdateProgress,
  onOpenCommitmentEditor,
}: BooksCompletionDrawerProps) => {
  const { toast } = useToast();
  const {
    booksCommitted,
    booksRead,
    otherBooksCommitted,
    otherBooksRead,
    toggleBookRead,
    toggleOtherBookRead,
    isLoading,
  } = useSyncedBooks();
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleBookRead = async (bookId: string) => {
    setIsSaving(true);
    const isCurrentlyRead = booksRead.has(bookId);
    
    try {
      await toggleBookRead(bookId);
      
      const newCount = isCurrentlyRead 
        ? booksRead.size - 1 + otherBooksRead.length
        : booksRead.size + 1 + otherBooksRead.length;
      await onUpdateProgress(newCount);
      
      if (!isCurrentlyRead) {
        const book = BOOKS.find(b => b.id === bookId);
        
        // Celebration only when marking as read!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        toast({
          title: "📚 Book finished!",
          description: book?.title || "Great job!",
        });
        
        onClose();
      } else {
        toast({
          title: "Book unmarked",
          description: "Removed from completed books",
        });
      }
    } catch {
      toast({
        title: "Error saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOtherBookRead = async (bookTitle: string) => {
    setIsSaving(true);
    const isCurrentlyRead = otherBooksRead.includes(bookTitle);
    
    try {
      await toggleOtherBookRead(bookTitle);
      
      const newCount = isCurrentlyRead
        ? booksRead.size + otherBooksRead.length - 1
        : booksRead.size + otherBooksRead.length + 1;
      await onUpdateProgress(newCount);
      
      if (!isCurrentlyRead) {
        // Celebration only when marking as read!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        toast({
          title: "📚 Book finished!",
          description: bookTitle,
        });
        
        onClose();
      } else {
        toast({
          title: "Book unmarked",
          description: "Removed from completed books",
        });
      }
    } catch {
      toast({
        title: "Error saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get all committed books (both read and unread)
  const committedBooksList = BOOKS.filter(book => booksCommitted.has(book.id));
  const hasAnyCommittedBooks = committedBooksList.length > 0 || otherBooksCommitted.length > 0;
  const totalRead = booksRead.size + otherBooksRead.length;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Mark Book as Finished
          </DrawerTitle>
          <DrawerDescription>
            {totalRead} of {booksCommitted.size + otherBooksCommitted.length} books completed
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60dvh] flex-1 min-h-0">
          {!hasAnyCommittedBooks ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium mb-1">No books committed!</p>
              <p className="text-sm mb-4">Choose which books you want to read this preseason</p>
              {onOpenCommitmentEditor && (
                <Button
                  onClick={() => {
                    onClose();
                    onOpenCommitmentEditor();
                  }}
                  className="gap-2"
                >
                  Set Your Standards
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Which book did you finish?
              </h4>
              
              {committedBooksList.map((book) => {
                const isRead = booksRead.has(book.id);
                return (
                  <button
                    key={book.id}
                    onClick={() => handleToggleBookRead(book.id)}
                    disabled={isSaving || isLoading}
                    className={cn(
                      "flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all",
                      isRead 
                        ? "bg-green-500/10 ring-1 ring-green-500/50" 
                        : "bg-muted/50 hover:bg-purple-500/10 hover:ring-1 hover:ring-purple-500/50",
                      "active:scale-[0.98]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isRead ? "bg-green-500/20" : "bg-purple-500/20"
                    )}>
                      <BookOpen className={cn("h-5 w-5", isRead ? "text-green-500" : "text-purple-500")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </div>
                    <Check className={cn(
                      "h-5 w-5",
                      isRead ? "text-green-500" : "text-muted-foreground/30"
                    )} />
                  </button>
                );
              })}
              
              {otherBooksCommitted.map((book, index) => {
                const isRead = otherBooksRead.includes(book);
                return (
                  <button
                    key={`other-${index}`}
                    onClick={() => handleToggleOtherBookRead(book)}
                    disabled={isSaving || isLoading}
                    className={cn(
                      "flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all",
                      isRead 
                        ? "bg-green-500/10 ring-1 ring-green-500/50" 
                        : "bg-muted/50 hover:bg-purple-500/10 hover:ring-1 hover:ring-purple-500/50",
                      "active:scale-[0.98]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isRead ? "bg-green-500/20" : "bg-purple-500/20"
                    )}>
                      <BookOpen className={cn("h-5 w-5", isRead ? "text-green-500" : "text-purple-500")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{book}</p>
                      <p className="text-xs text-muted-foreground">Custom book</p>
                    </div>
                    <Check className={cn(
                      "h-5 w-5",
                      isRead ? "text-green-500" : "text-muted-foreground/30"
                    )} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-6">
          <Button
            onClick={onClose}
            className="w-full"
            size="lg"
          >
            Done
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// Legacy export for backward compatibility
export const BooksSelectionDrawer = BooksCompletionDrawer;
