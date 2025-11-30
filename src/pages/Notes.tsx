import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotes } from "@/hooks/useNotes";
import { NoteCard } from "@/components/notes/NoteCard";
import { TagFilterSheet } from "@/components/notes/TagFilterSheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Notes() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<"date" | "title">("date");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const { notes, isLoading, createNote } = useNotes(sortBy, filterTags);

  const handleCreateNote = async () => {
    const newNote = await createNote();
    navigate(`/notes/${newNote.id}`);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">My Notes</h1>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "title")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (newest first)</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            <TagFilterSheet selectedTags={filterTags} onTagsChange={setFilterTags} />
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No notes yet</h2>
            <p className="text-muted-foreground mb-6">
              {filterTags.length > 0
                ? "No notes match your filter. Try removing some tags."
                : "Start taking notes to organize your work."}
            </p>
            <Button onClick={handleCreateNote} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Note
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => navigate(`/notes/${note.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {notes.length > 0 && (
        <Button
          onClick={handleCreateNote}
          size="lg"
          className="fixed bottom-20 right-6 h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
