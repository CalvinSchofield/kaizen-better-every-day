import { useState, useEffect } from "react";
import { BookMarked, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
}

const BOOKS: Book[] = [
  {
    id: "compound-effect",
    title: "The Compound Effect",
    author: "Darren Hardy",
    summary: "Small, consistent daily actions create massive results over time. Shows how tiny improvements in your pitch, attitude, and work ethic compound into huge commission checks by summer's end."
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    summary: "Build systems that make success automatic. Learn to stack habits that turn you into a closing machine—one small improvement at a time."
  },
  {
    id: "go-for-no",
    title: "Go for No!",
    author: "Richard Fenton & Andrea Waltz",
    summary: "Reframe rejection as progress toward yes. The more doors that close in your face, the closer you are to your next sale. This mindset shift is a game-changer for D2D."
  },
  {
    id: "miracle-morning",
    title: "The Miracle Morning",
    author: "Hal Elrod",
    summary: "Start every day with intention before you hit the doors. A powerful morning routine gives you the energy and focus to outwork everyone else."
  },
  {
    id: "10x-rule",
    title: "The 10X Rule",
    author: "Grant Cardone",
    summary: "Whatever effort you think is required, multiply it by 10. Massive action = massive results. Perfect for crushing sales goals."
  },
  {
    id: "d2d-millionaire",
    title: "Door to Door Millionaire",
    author: "Lenny Gray",
    summary: "Written specifically for D2D sales. Real strategies from someone who built an empire knocking doors—exactly what you're doing this summer."
  },
  {
    id: "happiness-advantage",
    title: "The Happiness Advantage",
    author: "Shawn Achor",
    summary: "Positivity isn't just feel-good—it's a competitive edge. Happy salespeople outsell negative ones by 37%. Learn to stay energized through the grind."
  },
  {
    id: "thinking-big",
    title: "The Magic of Thinking Big",
    author: "David Schwartz",
    summary: "Your results are limited only by your thinking. Expand what you believe is possible and watch your sales follow."
  },
  {
    id: "never-split",
    title: "Never Split the Difference",
    author: "Chris Voss",
    summary: "FBI hostage negotiator tactics for sales. Master tactical empathy and get customers to say yes without feeling pressured."
  },
  {
    id: "extreme-ownership",
    title: "Extreme Ownership",
    author: "Jocko Willink & Leif Babin",
    summary: "Take 100% responsibility for your results. No excuses, no blame—just solutions. The mindset that separates top performers."
  },
  {
    id: "power-one-more",
    title: "The Power of One More",
    author: "Ed Mylett",
    summary: "One more door, one more attempt, one more day of effort. The philosophy that turns good summers into legendary ones."
  },
  {
    id: "abcs-closing",
    title: "ABC'$ of Closing",
    author: "Sam Taggart",
    summary: "The D2D bible. Proven closing techniques from the founder of D2D Experts—mandatory reading for any serious rep."
  },
  {
    id: "man-thinketh",
    title: "As a Man Thinketh",
    author: "James Allen",
    summary: "Your thoughts shape your reality. A short, powerful read on mastering your mindset to achieve any goal."
  },
  {
    id: "psychology-selling",
    title: "The Psychology of Selling",
    author: "Brian Tracy",
    summary: "Understand why people buy. When you know the psychology, objections become opportunities."
  },
  {
    id: "above-line",
    title: "Above the Line",
    author: "Urban Meyer",
    summary: "Championship-level discipline and accountability. Build the mental toughness to perform when it matters most."
  },
  {
    id: "win-friends",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    summary: "The classic guide to connecting with anyone. Build instant rapport at the door and turn strangers into customers."
  },
  {
    id: "success-habits",
    title: "Millionaire Success Habits",
    author: "Dean Graziosi",
    summary: "Daily habits that separate the wealthy from everyone else. Apply these to your sales career starting day one."
  },
  {
    id: "one-thing",
    title: "The One Thing",
    author: "Gary Keller",
    summary: "Focus beats multitasking every time. Identify the ONE thing that moves the needle most and dominate it."
  },
  {
    id: "cant-hurt-me",
    title: "Can't Hurt Me",
    author: "David Goggins",
    summary: "Push past every mental barrier. When you're tired, hot, and want to quit—this book teaches you to keep going."
  }
];

// Use localStorage to track which specific books are read
const BOOKS_READ_KEY = "kaizen-books-read";

export const BooksSection = () => {
  const { goals, updateGoals, isUpdating } = useRepGoals();
  const { toast } = useToast();
  const [booksRead, setBooksRead] = useState<Set<string>>(new Set());
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOOKS_READ_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setBooksRead(new Set(parsed));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Sync localStorage and goals when books change
  const handleBookToggle = async (bookId: string) => {
    const newBooksRead = new Set(booksRead);
    
    if (newBooksRead.has(bookId)) {
      newBooksRead.delete(bookId);
    } else {
      newBooksRead.add(bookId);
    }
    
    setBooksRead(newBooksRead);
    
    // Save to localStorage
    localStorage.setItem(BOOKS_READ_KEY, JSON.stringify([...newBooksRead]));
    
    // Update goals with new count
    const newCount = newBooksRead.size;
    try {
      await updateGoals({ books_progress: newCount });
      
      if (newBooksRead.has(bookId)) {
        toast({
          title: "Book completed! 📚",
          description: `${BOOKS.find(b => b.id === bookId)?.title} marked as read`,
        });
      }
    } catch (error) {
      toast({
        title: "Error saving progress",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const booksToShow = showAll ? BOOKS : BOOKS.slice(0, 6);
  const booksReadCount = booksRead.size;
  const booksGoal = goals?.books_goal || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-lg">Sales Books</CardTitle>
          </div>
          {booksGoal > 0 && (
            <Badge 
              variant={booksReadCount >= booksGoal ? "default" : "secondary"}
              className={cn(
                "transition-colors",
                booksReadCount >= booksGoal && "bg-green-600 hover:bg-green-700"
              )}
            >
              {booksReadCount}/{booksGoal} read
            </Badge>
          )}
          {booksGoal === 0 && booksReadCount > 0 && (
            <Badge variant="secondary">
              {booksReadCount} read
            </Badge>
          )}
        </div>
        <CardDescription>
          Check off books as you read them to track your commitment
        </CardDescription>
        {booksGoal > 0 && (
          <div className="mt-3 space-y-1">
            <Progress 
              value={Math.min((booksReadCount / booksGoal) * 100, 100)} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(Math.min((booksReadCount / booksGoal) * 100, 100))}% complete
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {booksToShow.map((book) => {
          const isRead = booksRead.has(book.id);
          const isExpanded = expandedBook === book.id;
          
          return (
            <Collapsible 
              key={book.id} 
              open={isExpanded}
              onOpenChange={(open) => setExpandedBook(open ? book.id : null)}
            >
              <div 
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all",
                  isRead ? "bg-green-500/10" : "bg-muted/50 hover:bg-muted"
                )}
              >
                <Checkbox
                  id={book.id}
                  checked={isRead}
                  onCheckedChange={() => handleBookToggle(book.id)}
                  disabled={isUpdating}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <CollapsibleTrigger asChild>
                    <button 
                      className="w-full text-left flex items-center justify-between gap-2"
                      type="button"
                    >
                      <div className="min-w-0">
                        <div className={cn(
                          "font-medium text-sm transition-colors",
                          isRead && "text-muted-foreground line-through"
                        )}>
                          {book.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {book.author}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isRead && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {book.summary}
                    </p>
                  </CollapsibleContent>
                </div>
              </div>
            </Collapsible>
          );
        })}
        
        {BOOKS.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show all {BOOKS.length} books
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
