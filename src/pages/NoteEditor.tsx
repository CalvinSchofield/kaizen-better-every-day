import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNote } from "@/hooks/useNotes";
import { useNotes } from "@/hooks/useNotes";
import { RichTextEditor } from "@/components/notes/RichTextEditor";
import { TagInput } from "@/components/notes/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { JSONContent } from "@tiptap/react";
import { debounce } from "lodash";

export default function NoteEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { note, isLoading } = useNote(id!);
  const { updateNote, deleteNote } = useNotes();
  const [title, setTitle] = useState("");
  const [bodyJson, setBodyJson] = useState<JSONContent>({ type: "doc", content: [] });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with note data
  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setBodyJson(note.body_json);
    }
  }, [note]);

  // Debounced auto-save for title
  const debouncedTitleSave = useCallback(
    debounce((newTitle: string) => {
      if (id) {
        setIsSaving(true);
        updateNote(
          { id, title: newTitle },
          {
            onSettled: () => setIsSaving(false),
          }
        );
      }
    }, 500),
    [id]
  );

  // Debounced auto-save for body
  const debouncedBodySave = useCallback(
    debounce((newBody: JSONContent) => {
      if (id) {
        setIsSaving(true);
        updateNote(
          { id, body_json: newBody },
          {
            onSettled: () => setIsSaving(false),
          }
        );
      }
    }, 500),
    [id]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedTitleSave(newTitle);
  };

  const handleBodyChange = (newBody: JSONContent) => {
    setBodyJson(newBody);
    debouncedBodySave(newBody);
  };

  const handleDelete = () => {
    if (id) {
      deleteNote(id);
      navigate("/notes");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24">
        <div className="container mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Note not found</h2>
          <Button onClick={() => navigate("/notes")}>Back to Notes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/notes")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-4">
            {isSaving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
            <span className="text-xs text-muted-foreground">
              Last edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            className="text-2xl font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>Tags</Label>
          <TagInput noteId={note.id} currentTags={note.tags || []} />
        </div>

        {/* Rich Text Editor */}
        <div className="space-y-2">
          <Label>Content</Label>
          <RichTextEditor
            content={bodyJson}
            onChange={handleBodyChange}
            placeholder="Start writing..."
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
