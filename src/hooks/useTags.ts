import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export const useTags = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Tag[];
    },
  });

  const searchTags = (query: string) => {
    if (!tags) return [];
    const lowerQuery = query.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(lowerQuery));
  };

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const normalizedName = name.toLowerCase().trim();

      // Check if tag already exists
      const existing = tags?.find((t) => t.name === normalizedName);
      if (existing) return existing;

      const { data, error } = await supabase
        .from("tags")
        .insert({
          user_id: user.id,
          name: normalizedName,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addTagToNoteMutation = useMutation({
    mutationFn: async ({ noteId, tagId }: { noteId: string; tagId: string }) => {
      const { error } = await supabase
        .from("note_tags")
        .insert({
          note_id: noteId,
          tag_id: tagId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to add tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeTagFromNoteMutation = useMutation({
    mutationFn: async ({ noteId, tagId }: { noteId: string; tagId: string }) => {
      const { error } = await supabase
        .from("note_tags")
        .delete()
        .eq("note_id", noteId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    tags: tags || [],
    isLoading,
    searchTags,
    createTag: createTagMutation.mutateAsync,
    addTagToNote: addTagToNoteMutation.mutateAsync,
    removeTagFromNote: removeTagFromNoteMutation.mutateAsync,
  };
};
