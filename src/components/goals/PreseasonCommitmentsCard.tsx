import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Timer, Dumbbell, Phone, Target, ChevronDown, Check, Plus, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOOKS } from "./BooksSelectionDrawer";
import { useSyncedBooks } from "@/hooks/useSyncedBooks";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

interface PreseasonCommitmentsCardProps {
  goals: {
    books_goal?: number | null;
    training_hours_goal?: number | null;
    role_plays_goal?: number | null;
    role_plays_progress?: number | null;
    monday_night_lights_goal?: number | null;
  };
  onIncrementRolePlays?: (increment: number) => void;
}

const formatTrainingTime = (minutesPerDay: number | null | undefined): string => {
  if (!minutesPerDay) return "0m/day";
  const hours = Math.floor(minutesPerDay / 60);
  const mins = minutesPerDay % 60;
  if (hours > 0 && mins > 0) return `${hours}hr ${mins}m/day`;
  if (hours > 0) return `${hours}hr/day`;
  return `${mins}m/day`;
};

export const PreseasonCommitmentsCard = ({ goals, onIncrementRolePlays }: PreseasonCommitmentsCardProps) => {
  const [isBooksExpanded, setIsBooksExpanded] = useState(false);
  
  const {
    booksCommitted,
    booksRead,
    otherBooksCommitted,
    otherBooksRead,
    toggleBookRead,
    toggleOtherBookRead,
    isLoading: isBooksLoading,
  } = useSyncedBooks();

  const committedBooksList = BOOKS.filter(b => booksCommitted.has(b.id));
  const totalBooks = committedBooksList.length + otherBooksCommitted.length;
  const totalRead = booksRead.size + otherBooksRead.length;
  const allBooksRead = totalBooks > 0 && totalRead >= totalBooks;

  const rolePlaysDone = goals.role_plays_progress || 0;
  const rolePlaysGoal = goals.role_plays_goal || 0;

  const handleBookRead = async (bookId: string) => {
    const wasMarkedRead = await toggleBookRead(bookId);
    if (wasMarkedRead) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 }, colors: ['#f59e0b', '#d97706'] });
    }
  };

  const handleOtherBookRead = async (title: string) => {
    const wasMarkedRead = await toggleOtherBookRead(title);
    if (wasMarkedRead) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 }, colors: ['#f59e0b', '#d97706'] });
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Your Preseason Commitments</span>
      </div>

      {/* Books - Expandable with checklist */}
      <div className="rounded-lg bg-muted/40 overflow-hidden">
        <button
          onClick={() => setIsBooksExpanded(!isBooksExpanded)}
          className="flex items-center gap-3 w-full p-3 text-left"
        >
          <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Books to Read</p>
            <p className="text-xs text-muted-foreground">
              {totalRead} of {totalBooks} completed
            </p>
          </div>
          {allBooksRead && totalBooks > 0 && (
            <Sparkles className="h-4 w-4 text-amber-500" />
          )}
          <div className="flex items-center gap-1.5 bg-background/60 px-2 py-0.5 rounded-full">
            <span className="text-sm font-bold tabular-nums">{totalRead}/{totalBooks}</span>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isBooksExpanded && "rotate-180"
          )} />
        </button>
        
        <AnimatePresence>
          {isBooksExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-1">
                {committedBooksList.map((book) => {
                  const isRead = booksRead.has(book.id);
                  return (
                    <label
                      key={book.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        isRead ? "bg-primary/5" : "hover:bg-muted/60"
                      )}
                    >
                      <Checkbox
                        checked={isRead}
                        onCheckedChange={() => handleBookRead(book.id)}
                        disabled={isBooksLoading}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium leading-tight",
                          isRead && "line-through text-muted-foreground"
                        )}>
                          {book.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                      </div>
                      {isRead && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                    </label>
                  );
                })}
                {otherBooksCommitted.map((title, i) => {
                  const isRead = otherBooksRead.includes(title);
                  return (
                    <label
                      key={`other-${i}`}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        isRead ? "bg-primary/5" : "hover:bg-muted/60"
                      )}
                    >
                      <Checkbox
                        checked={isRead}
                        onCheckedChange={() => handleOtherBookRead(title)}
                        disabled={isBooksLoading}
                        className="mt-0.5"
                      />
                      <p className={cn(
                        "text-sm font-medium leading-tight flex-1",
                        isRead && "line-through text-muted-foreground"
                      )}>
                        {title}
                      </p>
                      {isRead && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                    </label>
                  );
                })}
                {totalBooks === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No books committed yet
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Role Plays - Interactive counter */}
      <div className="rounded-lg bg-muted/40 p-3">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-4 w-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Role Plays</p>
            <p className="text-xs text-muted-foreground">
              {rolePlaysDone} of {rolePlaysGoal} completed
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onIncrementRolePlays?.(-1)}
              disabled={rolePlaysDone <= 0}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-bold tabular-nums w-12 text-center">
              {rolePlaysDone}/{rolePlaysGoal}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onIncrementRolePlays?.(1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {rolePlaysGoal > 0 && (
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (rolePlaysDone / rolePlaysGoal) * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}
      </div>

      {/* Training Hours */}
      <div className="rounded-lg bg-muted/40 p-3">
        <div className="flex items-center gap-3">
          <Timer className="h-4 w-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Daily Training</p>
            <p className="text-xs text-muted-foreground">
              Master: product, door approach, in-home process, competitors
            </p>
          </div>
          <span className="text-sm font-bold tabular-nums bg-background/60 px-2 py-0.5 rounded-full">
            {formatTrainingTime(goals.training_hours_goal)}
          </span>
        </div>
      </div>

      {/* MNL - 100% Attendance */}
      <div className="rounded-lg bg-muted/40 p-3">
        <div className="flex items-center gap-3">
          <Phone className="h-4 w-4 text-purple-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Monday Night Lights</p>
            <p className="text-xs text-muted-foreground">
              Weekly online training sessions
            </p>
          </div>
          <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            100% Attendance
          </span>
        </div>
      </div>
    </div>
  );
};
