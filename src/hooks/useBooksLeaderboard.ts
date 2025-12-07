import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BookLeader {
  userId: string;
  name: string;
  booksRead: number;
  isRookie: boolean;
}

interface BooksLeaderboard {
  mostReadOverall: BookLeader | null;
  mostReadRookie: BookLeader | null;
}

export const useBooksLeaderboard = () => {
  return useQuery({
    queryKey: ["books-leaderboard"],
    queryFn: async () => {
      // Fetch all rep goals with books progress
      const { data: goalsData, error: goalsError } = await supabase
        .from("rep_goals")
        .select("user_id, books_progress")
        .gt("books_progress", 0);

      if (goalsError) throw goalsError;

      // Fetch rep data to get names and year
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      const repsMap = new Map(
        repsData?.map((r) => [r.user_id, { name: r.name, year: r.year }]) || []
      );

      // Process and find leaders
      const leaders: BookLeader[] = (goalsData || [])
        .map((g) => {
          const repInfo = repsMap.get(g.user_id);
          if (!repInfo) return null;
          return {
            userId: g.user_id,
            name: repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, "").trim(),
            booksRead: g.books_progress || 0,
            isRookie: repInfo.year === "Rookie",
          };
        })
        .filter((l): l is BookLeader => l !== null && l.booksRead > 0)
        .sort((a, b) => b.booksRead - a.booksRead);

      const leaderboard: BooksLeaderboard = {
        mostReadOverall: leaders[0] || null,
        mostReadRookie: leaders.find((l) => l.isRookie) || null,
      };

      return leaderboard;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
