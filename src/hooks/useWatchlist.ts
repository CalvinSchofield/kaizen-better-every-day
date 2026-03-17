import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";

export const useWatchlist = () => {
  const { userId } = useCurrentUserId();
  const queryClient = useQueryClient();

  const { data: watchedUserIds = [], isLoading } = useQuery({
    queryKey: ["watchlist", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("watchlist")
        .select("watched_user_id")
        .eq("user_id", userId);
      if (error) throw error;
      return data.map((r) => r.watched_user_id);
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const addToWatchlist = useMutation({
    mutationFn: async (watchedUserId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("watchlist")
        .insert({ user_id: userId, watched_user_id: watchedUserId });
      if (error) throw error;
    },
    onMutate: async (watchedUserId) => {
      await queryClient.cancelQueries({ queryKey: ["watchlist", userId] });
      const prev = queryClient.getQueryData<string[]>(["watchlist", userId]) || [];
      queryClient.setQueryData(["watchlist", userId], [...prev, watchedUserId]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["watchlist", userId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    },
  });

  const removeFromWatchlist = useMutation({
    mutationFn: async (watchedUserId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", userId)
        .eq("watched_user_id", watchedUserId);
      if (error) throw error;
    },
    onMutate: async (watchedUserId) => {
      await queryClient.cancelQueries({ queryKey: ["watchlist", userId] });
      const prev = queryClient.getQueryData<string[]>(["watchlist", userId]) || [];
      queryClient.setQueryData(["watchlist", userId], prev.filter((id) => id !== watchedUserId));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["watchlist", userId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    },
  });

  const isWatching = (targetUserId: string) => watchedUserIds.includes(targetUserId);

  const toggleWatchlist = (targetUserId: string) => {
    if (isWatching(targetUserId)) {
      removeFromWatchlist.mutate(targetUserId);
    } else {
      addToWatchlist.mutate(targetUserId);
    }
  };

  return {
    watchedUserIds,
    isLoading,
    isWatching,
    toggleWatchlist,
    addToWatchlist: addToWatchlist.mutate,
    removeFromWatchlist: removeFromWatchlist.mutate,
  };
};
