import { useCallback, useMemo } from "react";
import { useRepGoals } from "./useRepGoals";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRepData } from "./useRepData";

// Legacy localStorage keys for migration
const BOOKS_COMMITTED_KEY = "kaizen-books-committed";
const BOOKS_READ_KEY = "kaizen-books-read";
const OTHER_BOOKS_COMMITTED_KEY = "kaizen-other-books-committed";
const OTHER_BOOKS_READ_KEY = "kaizen-other-books-read";

/**
 * Hook for synced book data across devices.
 * Migrates from localStorage to database on first load.
 */
export const useSyncedBooks = () => {
  const { goals, isLoading } = useRepGoals();
  const { repData } = useRepData();
  const queryClient = useQueryClient();

  // Parse book arrays from goals
  const booksCommitted = useMemo(() => {
    const arr = goals?.books_committed;
    return new Set(Array.isArray(arr) ? arr : []);
  }, [goals?.books_committed]);

  const booksRead = useMemo(() => {
    const arr = goals?.books_read;
    return new Set(Array.isArray(arr) ? arr : []);
  }, [goals?.books_read]);

  const otherBooksCommitted = useMemo(() => {
    const arr = goals?.other_books_committed;
    return Array.isArray(arr) ? arr : [];
  }, [goals?.other_books_committed]);

  const otherBooksRead = useMemo(() => {
    const arr = goals?.other_books_read;
    return Array.isArray(arr) ? arr : [];
  }, [goals?.other_books_read]);

  // Migrate from localStorage if database is empty but localStorage has data
  const migrateFromLocalStorage = useCallback(async () => {
    if (!repData?.user_id || isLoading) return false;
    
    // Check if we already have data in database
    if (booksCommitted.size > 0 || booksRead.size > 0 || 
        otherBooksCommitted.length > 0 || otherBooksRead.length > 0) {
      // Already have DB data, clear localStorage
      localStorage.removeItem(BOOKS_COMMITTED_KEY);
      localStorage.removeItem(BOOKS_READ_KEY);
      localStorage.removeItem(OTHER_BOOKS_COMMITTED_KEY);
      localStorage.removeItem(OTHER_BOOKS_READ_KEY);
      return false;
    }

    // Check localStorage
    try {
      const lsCommitted = localStorage.getItem(BOOKS_COMMITTED_KEY);
      const lsRead = localStorage.getItem(BOOKS_READ_KEY);
      const lsOtherCommitted = localStorage.getItem(OTHER_BOOKS_COMMITTED_KEY);
      const lsOtherRead = localStorage.getItem(OTHER_BOOKS_READ_KEY);

      const hasLocalData = lsCommitted || lsRead || lsOtherCommitted || lsOtherRead;
      if (!hasLocalData) return false;

      const committedArr = lsCommitted ? JSON.parse(lsCommitted) : [];
      const readArr = lsRead ? JSON.parse(lsRead) : [];
      const otherCommittedArr = lsOtherCommitted ? JSON.parse(lsOtherCommitted) : [];
      const otherReadArr = lsOtherRead ? JSON.parse(lsOtherRead) : [];

      // Migrate to database
      const { error } = await supabase
        .from('rep_goals')
        .upsert({
          user_id: repData.user_id,
          books_committed: committedArr,
          books_read: readArr,
          other_books_committed: otherCommittedArr,
          other_books_read: otherReadArr,
          books_goal: committedArr.length + otherCommittedArr.length,
          books_progress: readArr.length + otherReadArr.length,
        }, { onConflict: 'user_id' });

      if (!error) {
        // Clear localStorage after successful migration
        localStorage.removeItem(BOOKS_COMMITTED_KEY);
        localStorage.removeItem(BOOKS_READ_KEY);
        localStorage.removeItem(OTHER_BOOKS_COMMITTED_KEY);
        localStorage.removeItem(OTHER_BOOKS_READ_KEY);
        queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
        return true;
      }
    } catch {
      // Ignore migration errors
    }
    return false;
  }, [repData?.user_id, isLoading, booksCommitted.size, booksRead.size, 
      otherBooksCommitted.length, otherBooksRead.length, queryClient]);

  // Toggle book committed status
  const toggleBookCommitted = useCallback(async (bookId: string) => {
    if (!repData?.user_id) return;

    const newSet = new Set(booksCommitted);
    if (newSet.has(bookId)) {
      newSet.delete(bookId);
    } else {
      newSet.add(bookId);
    }

    const newArr = [...newSet];
    const newGoal = newArr.length + otherBooksCommitted.length;

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        books_committed: newArr,
        books_goal: newGoal,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
    }
  }, [repData?.user_id, booksCommitted, otherBooksCommitted.length, queryClient]);

  // Toggle book read status
  const toggleBookRead = useCallback(async (bookId: string) => {
    if (!repData?.user_id) return;

    const newSet = new Set(booksRead);
    const wasRead = newSet.has(bookId);
    if (wasRead) {
      newSet.delete(bookId);
    } else {
      newSet.add(bookId);
    }

    const newArr = [...newSet];
    const newProgress = newArr.length + otherBooksRead.length;

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        books_read: newArr,
        books_progress: newProgress,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard-weekly'] });
    }
    
    return !wasRead; // Return true if book was marked as read (for celebration)
  }, [repData?.user_id, booksRead, otherBooksRead.length, queryClient]);

  // Add other book to committed list
  const addOtherBookCommitted = useCallback(async (bookTitle: string) => {
    if (!repData?.user_id || !bookTitle.trim()) return;

    const newArr = [...otherBooksCommitted, bookTitle.trim()];
    const newGoal = booksCommitted.size + newArr.length;

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        other_books_committed: newArr,
        books_goal: newGoal,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
    }
  }, [repData?.user_id, otherBooksCommitted, booksCommitted.size, queryClient]);

  // Remove other book from committed list
  const removeOtherBookCommitted = useCallback(async (index: number) => {
    if (!repData?.user_id) return;

    const newArr = otherBooksCommitted.filter((_, i) => i !== index);
    const newGoal = booksCommitted.size + newArr.length;

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        other_books_committed: newArr,
        books_goal: newGoal,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
    }
  }, [repData?.user_id, otherBooksCommitted, booksCommitted.size, queryClient]);

  // Toggle other book read status
  const toggleOtherBookRead = useCallback(async (bookTitle: string) => {
    if (!repData?.user_id) return;

    const wasRead = otherBooksRead.includes(bookTitle);
    const newArr = wasRead
      ? otherBooksRead.filter(b => b !== bookTitle)
      : [...otherBooksRead, bookTitle];

    const newProgress = booksRead.size + newArr.length;

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        other_books_read: newArr,
        books_progress: newProgress,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard-weekly'] });
    }

    return !wasRead; // Return true if marked as read
  }, [repData?.user_id, otherBooksRead, booksRead.size, queryClient]);

  return {
    booksCommitted,
    booksRead,
    otherBooksCommitted,
    otherBooksRead,
    isLoading,
    migrateFromLocalStorage,
    toggleBookCommitted,
    toggleBookRead,
    addOtherBookCommitted,
    removeOtherBookCommitted,
    toggleOtherBookRead,
    totalCommitted: booksCommitted.size + otherBooksCommitted.length,
    totalRead: booksRead.size + otherBooksRead.length,
  };
};
