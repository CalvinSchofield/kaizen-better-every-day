import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JSONContent } from "@tiptap/react";

export interface Note {
  id: string;
  user_id: string;
  title: string | null;
  body_json: JSONContent;
  body_preview: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  tags?: Array<{ id: string; name: string }>;
}

export interface NoteWithTags extends Note {
  note_tags: Array<{
    tags: {
      id: string;
      name: string;
    };
  }>;
}

const extractPreview = (json: JSONContent): string => {
  if (!json || !json.content) return "";
  
  const findText = (node: JSONContent): string => {
    if (node.type === "text") return node.text || "";
    if (node.content) {
      return node.content.map(findText).join(" ");
    }
    return "";
  };
  
  const text = findText(json);
  return text.slice(0, 100);
};

export const useNotes = (sortBy: "date" | "title" = "date", filterTags: string[] = []) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ["notes", sortBy, filterTags],
    queryFn: async () => {
      let query = supabase
        .from("notes")
        .select(`
          *,
          note_tags!inner (
            tags (
              id,
              name
            )
          )
        `)
        .eq("is_archived", false);

      // Apply tag filtering
      if (filterTags.length > 0) {
        query = query.in("note_tags.tags.id", filterTags);
      }

      // Apply sorting
      if (sortBy === "date") {
        query = query.order("updated_at", { ascending: false });
      } else {
        query = query.order("title", { ascending: true, nullsFirst: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include tags
      const notesWithTags = (data as unknown as NoteWithTags[]).map((note) => ({
        ...note,
        tags: note.note_tags?.map((nt) => nt.tags) || [],
      }));

      return notesWithTags as Note[];
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          title: null,
          body_json: { type: "doc", content: [] },
          body_preview: null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      body_json,
    }: {
      id: string;
      title?: string | null;
      body_json?: JSONContent;
    }) => {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updateData.title = title;
      if (body_json !== undefined) {
        updateData.body_json = body_json;
        updateData.body_preview = extractPreview(body_json);
      }

      const { data, error } = await supabase
        .from("notes")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    notes: notes || [],
    isLoading,
    createNote: createNoteMutation.mutateAsync,
    updateNote: updateNoteMutation.mutate,
    deleteNote: deleteNoteMutation.mutate,
  };
};

export const useNote = (id: string) => {
  const { data: note, isLoading } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select(`
          *,
          note_tags (
            tags (
              id,
              name
            )
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const noteWithTags = data as unknown as NoteWithTags;
      return {
        ...noteWithTags,
        tags: noteWithTags.note_tags?.map((nt) => nt.tags) || [],
      } as Note;
    },
    enabled: !!id,
  });

  return { note, isLoading };
};
