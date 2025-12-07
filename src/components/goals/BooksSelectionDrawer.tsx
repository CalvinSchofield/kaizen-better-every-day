import { useState, useEffect } from "react";
import { BookOpen, Check, Plus, X } from "lucide-react";
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

interface Book {
  id: string;
  title: string;
  author: string;
}

const BOOKS: Book[] = [
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

const BOOKS_READ_KEY = "kaizen-books-read";
const OTHER_BOOKS_KEY = "kaizen-other-books";

interface BooksSelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentProgress: number;
  onUpdateProgress: (newProgress: number) => Promise<unknown>;
}

export const BooksSelectionDrawer = ({
  isOpen,
  onClose,
  currentProgress,
  onUpdateProgress,
}: BooksSelectionDrawerProps) => {
  const { toast } = useToast();
  const [booksRead, setBooksRead] = useState<Set<string>>(new Set());
  const [otherBooks, setOtherBooks] = useState<string[]>([]);
  const [newOtherBook, setNewOtherBook] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOOKS_READ_KEY);
      if (stored) {
        setBooksRead(new Set(JSON.parse(stored)));
      }
      const otherStored = localStorage.getItem(OTHER_BOOKS_KEY);
      if (otherStored) {
        setOtherBooks(JSON.parse(otherStored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleBookToggle = async (bookId: string) => {
    setIsSaving(true);
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
      await onUpdateProgress(newCount);
      if (newBooksRead.has(bookId)) {
        const book = BOOKS.find(b => b.id === bookId);
        toast({
          title: "Book logged! 📚",
          description: book?.title,
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

  const handleAddOtherBook = async () => {
    if (!newOtherBook.trim()) return;
    
    setIsSaving(true);
    const newOtherBooks = [...otherBooks, newOtherBook.trim()];
    setOtherBooks(newOtherBooks);
    localStorage.setItem(OTHER_BOOKS_KEY, JSON.stringify(newOtherBooks));
    
    const newCount = booksRead.size + newOtherBooks.length;
    try {
      await onUpdateProgress(newCount);
      toast({
        title: "Book logged! 📚",
        description: newOtherBook.trim(),
      });
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
    const newOtherBooks = otherBooks.filter((_, i) => i !== index);
    setOtherBooks(newOtherBooks);
    localStorage.setItem(OTHER_BOOKS_KEY, JSON.stringify(newOtherBooks));
    
    const newCount = booksRead.size + newOtherBooks.length;
    try {
      await onUpdateProgress(newCount);
    } catch {
      toast({
        title: "Error saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalRead = booksRead.size + otherBooks.length;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="flex items-center justify-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-500" />
            Log a Book
          </DrawerTitle>
          <DrawerDescription>
            {totalRead} book{totalRead !== 1 ? 's' : ''} read
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Recommended Books */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Recommended Books</h4>
            {BOOKS.map((book) => {
              const isRead = booksRead.has(book.id);
              return (
                <button
                  key={book.id}
                  onClick={() => handleBookToggle(book.id)}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all",
                    isRead ? "bg-green-500/10 ring-1 ring-green-500/50" : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <Checkbox checked={isRead} className="pointer-events-none" />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium text-sm",
                      isRead && "text-muted-foreground line-through"
                    )}>
                      {book.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                  </div>
                  {isRead && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Other Books */}
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Other Books</h4>
            
            {otherBooks.map((book, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 ring-1 ring-green-500/50"
              >
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="flex-1 text-sm">{book}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveOtherBook(index)}
                  disabled={isSaving}
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
                disabled={!newOtherBook.trim() || isSaving}
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
