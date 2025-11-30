import { Note } from "@/hooks/useNotes";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
}

export const NoteCard = ({ note, onClick }: NoteCardProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
    >
      <h3 className="font-semibold text-lg mb-1">
        {note.title || "Untitled"}
      </h3>
      
      {note.body_preview && (
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
          {note.body_preview}
        </p>
      )}
      
      <div className="flex flex-wrap gap-2 mb-2">
        {note.tags?.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="text-xs">
            {tag.name}
          </Badge>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
      </p>
    </button>
  );
};
