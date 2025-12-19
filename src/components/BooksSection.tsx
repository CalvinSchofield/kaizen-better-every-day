import { useState } from "react";
import { BookMarked, Check, ChevronDown, ChevronUp, Trophy, Crown, ArrowRight, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useBooksLeaderboard } from "@/hooks/useBooksLeaderboard";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useSyncedBooks } from "@/hooks/useSyncedBooks";

interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  isbn: string;
  category: 'd2d' | 'sales' | 'mindset';
}

// Books organized by category: D2D Specific, Sales General, Life/Mindset
const BOOKS: Book[] = [
  // === D2D SPECIFIC ===
  {
    id: "d2d-millionaire",
    title: "Door to Door Millionaire",
    author: "Lenny Gray",
    isbn: "9781733016902",
    category: "d2d",
    summary: "Written specifically for D2D sales. Real strategies from someone who built an empire knocking doors—exactly what you're doing this summer."
  },
  {
    id: "abcs-closing",
    title: "ABC'$ of Closing",
    author: "Sam Taggart",
    isbn: "9780578558530",
    category: "d2d",
    summary: "The D2D bible. Proven closing techniques from the founder of D2D Experts—mandatory reading for any serious rep."
  },
  // === SALES GENERAL ===
  {
    id: "go-for-no",
    title: "Go for No!",
    author: "Richard Fenton & Andrea Waltz",
    isbn: "9780966398137",
    category: "sales",
    summary: "Reframe rejection as progress toward yes. The more doors that close in your face, the closer you are to your next sale. This mindset shift is a game-changer for D2D."
  },
  {
    id: "never-split",
    title: "Never Split the Difference",
    author: "Chris Voss",
    isbn: "9780062407801",
    category: "sales",
    summary: "FBI hostage negotiator tactics for sales. Master tactical empathy and get customers to say yes without feeling pressured."
  },
  {
    id: "psychology-selling",
    title: "The Psychology of Selling",
    author: "Brian Tracy",
    isbn: "9780785288060",
    category: "sales",
    summary: "Understand why people buy. When you know the psychology, objections become opportunities."
  },
  {
    id: "win-friends",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    isbn: "9780671027032",
    category: "sales",
    summary: "The classic guide to connecting with anyone. Build instant rapport at the door and turn strangers into customers."
  },
  // === LIFE/MINDSET ===
  {
    id: "compound-effect",
    title: "The Compound Effect",
    author: "Darren Hardy",
    isbn: "9781593157241",
    category: "mindset",
    summary: "Small, consistent daily actions create massive results over time. Shows how tiny improvements in your pitch, attitude, and work ethic compound into huge commission checks by summer's end."
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    isbn: "9780735211292",
    category: "mindset",
    summary: "Build systems that make success automatic. Learn to stack habits that turn you into a closing machine—one small improvement at a time."
  },
  {
    id: "miracle-morning",
    title: "The Miracle Morning",
    author: "Hal Elrod",
    isbn: "9780979019715",
    category: "mindset",
    summary: "Start every day with intention before you hit the doors. A powerful morning routine gives you the energy and focus to outwork everyone else."
  },
  {
    id: "10x-rule",
    title: "The 10X Rule",
    author: "Grant Cardone",
    isbn: "9780470627600",
    category: "mindset",
    summary: "Whatever effort you think is required, multiply it by 10. Massive action = massive results. Perfect for crushing sales goals."
  },
  {
    id: "happiness-advantage",
    title: "The Happiness Advantage",
    author: "Shawn Achor",
    isbn: "9780307591548",
    category: "mindset",
    summary: "Positivity isn't just feel-good—it's a competitive edge. Happy salespeople outsell negative ones by 37%. Learn to stay energized through the grind."
  },
  {
    id: "thinking-big",
    title: "The Magic of Thinking Big",
    author: "David Schwartz",
    isbn: "9780671646783",
    category: "mindset",
    summary: "Your results are limited only by your thinking. Expand what you believe is possible and watch your sales follow."
  },
  {
    id: "extreme-ownership",
    title: "Extreme Ownership",
    author: "Jocko Willink & Leif Babin",
    isbn: "9781250183866",
    category: "mindset",
    summary: "Take 100% responsibility for your results. No excuses, no blame—just solutions. The mindset that separates top performers."
  },
  {
    id: "power-one-more",
    title: "The Power of One More",
    author: "Ed Mylett",
    isbn: "9781119815327",
    category: "mindset",
    summary: "One more door, one more attempt, one more day of effort. The philosophy that turns good summers into legendary ones."
  },
  {
    id: "man-thinketh",
    title: "As a Man Thinketh",
    author: "James Allen",
    isbn: "9781585426386",
    category: "mindset",
    summary: "Your thoughts shape your reality. A short, powerful read on mastering your mindset to achieve any goal."
  },
  {
    id: "above-line",
    title: "Above the Line",
    author: "Urban Meyer",
    isbn: "9781101980729",
    category: "mindset",
    summary: "Championship-level discipline and accountability. Build the mental toughness to perform when it matters most."
  },
  {
    id: "success-habits",
    title: "Millionaire Success Habits",
    author: "Dean Graziosi",
    isbn: "9781401957353",
    category: "mindset",
    summary: "Daily habits that separate the wealthy from everyone else. Apply these to your sales career starting day one."
  },
  {
    id: "one-thing",
    title: "The One Thing",
    author: "Gary Keller",
    isbn: "9781885167774",
    category: "mindset",
    summary: "Focus beats multitasking every time. Identify the ONE thing that moves the needle most and dominate it."
  },
  {
    id: "cant-hurt-me",
    title: "Can't Hurt Me",
    author: "David Goggins",
    isbn: "9781544512273",
    category: "mindset",
    summary: "Push past every mental barrier. When you're tired, hot, and want to quit—this book teaches you to keep going."
  }
];

export const BooksSection = () => {
  const navigate = useNavigate();
  const { goals, isUpdating } = useRepGoals();
  const { data: leaderboard } = useBooksLeaderboard();
  const { toast } = useToast();
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Use synced books hook for database-backed tracking
  const {
    booksCommitted,
    booksRead,
    otherBooksCommitted,
    otherBooksRead,
    toggleBookRead,
    toggleOtherBookRead,
    isLoading: isBooksLoading,
  } = useSyncedBooks();

  // Toggle book read status (only for committed books)
  const handleBookToggle = async (bookId: string) => {
    // Only allow toggling committed books
    if (!booksCommitted.has(bookId)) return;

    try {
      const wasMarkedAsRead = await toggleBookRead(bookId);
      
      if (wasMarkedAsRead) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
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

  // Toggle other book read status
  const handleOtherBookToggle = async (bookTitle: string) => {
    try {
      const wasMarkedAsRead = await toggleOtherBookRead(bookTitle);
      
      if (wasMarkedAsRead) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        toast({
          title: "Book completed! 📚",
          description: `${bookTitle} marked as read`,
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

  // Sort books: committed first, then by category order (d2d, sales, mindset)
  const sortedBooks = [...BOOKS].sort((a, b) => {
    const aCommitted = booksCommitted.has(a.id);
    const bCommitted = booksCommitted.has(b.id);
    
    // Committed books come first
    if (aCommitted && !bCommitted) return -1;
    if (!aCommitted && bCommitted) return 1;
    
    // Within same commitment status, maintain category order (already sorted in BOOKS array)
    return 0;
  });
  
  const booksToShow = showAll ? sortedBooks : sortedBooks.slice(0, 6);
  const booksReadCount = booksRead.size + otherBooksRead.length;
  const booksGoal = goals?.books_goal || 0;
  const totalCommitted = booksCommitted.size + otherBooksCommitted.length;
  const hasCommittedBooks = totalCommitted > 0;

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
          {hasCommittedBooks 
            ? "Check off books as you read them to track your progress"
            : "Commit to books on the Goals page to start tracking"
          }
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
        {/* Books Leaderboard - Always show */}
        {(leaderboard?.mostReadOverall || leaderboard?.mostReadRookie) && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Most Well Read</span>
            </div>
            <div className="space-y-1.5">
              {leaderboard.mostReadOverall && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <Crown className="h-3 w-3 text-amber-500" />
                    <span>{leaderboard.mostReadOverall.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {leaderboard.mostReadOverall.booksRead} books
                  </Badge>
                </div>
              )}
              {leaderboard.mostReadRookie && 
               leaderboard.mostReadRookie.userId !== leaderboard.mostReadOverall?.userId && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Top Rookie:</span>
                    <span>{leaderboard.mostReadRookie.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {leaderboard.mostReadRookie.booksRead} books
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA if no books committed */}
        {!hasCommittedBooks && (
          <div className="mb-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="text-center space-y-3">
              <BookMarked className="h-10 w-10 mx-auto text-purple-500 opacity-60" />
              <div>
                <p className="font-medium text-sm">No books committed yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose which books you want to read this preseason
                </p>
              </div>
              <Button
                onClick={() => navigate('/goals')}
                size="sm"
                className="gap-2"
              >
                Commit to Books
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Committed other books (custom books) */}
        {otherBooksCommitted.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-muted-foreground">Your Custom Books</p>
            {otherBooksCommitted.map((book, index) => {
              const isRead = otherBooksRead.includes(book);
              return (
                <div 
                  key={`other-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    isRead ? "bg-green-500/10" : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <Checkbox
                    id={`other-${index}`}
                    checked={isRead}
                    onCheckedChange={() => handleOtherBookToggle(book)}
                    disabled={isUpdating || isBooksLoading}
                    className="mt-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-medium text-sm transition-colors",
                      isRead && "text-muted-foreground line-through"
                    )}>
                      {book}
                    </div>
                    <div className="text-xs text-muted-foreground">Custom book</div>
                  </div>
                  {isRead && <Check className="h-4 w-4 text-green-500" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Recommended books list */}
        {booksToShow.map((book) => {
          const isRead = booksRead.has(book.id);
          const isCommitted = booksCommitted.has(book.id);
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
                  isRead ? "bg-green-500/10" : 
                  isCommitted ? "bg-muted/50 hover:bg-muted" : 
                  "bg-muted/30 opacity-60"
                )}
              >
                {isCommitted ? (
                  <Checkbox
                    id={book.id}
                    checked={isRead}
                    onCheckedChange={() => handleBookToggle(book.id)}
                    disabled={isUpdating || isBooksLoading}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 w-4 h-4 flex items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <CollapsibleTrigger asChild>
                    <button 
                      className="w-full text-left flex items-center justify-between gap-2"
                      type="button"
                    >
                      <div className="min-w-0">
                        <div className={cn(
                          "font-medium text-sm transition-colors",
                          isRead && "text-muted-foreground line-through",
                          !isCommitted && "text-muted-foreground"
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
                    {!isCommitted && (
                      <p className="text-xs text-purple-500 mt-2 italic">
                        Commit to this book on the Goals page to track it
                      </p>
                    )}
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
