import { useState, KeyboardEvent } from "react";
import { useTags } from "@/hooks/useTags";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TagInputProps {
  noteId: string;
  currentTags: Array<{ id: string; name: string }>;
}

export const TagInput = ({ noteId, currentTags }: TagInputProps) => {
  const { tags, createTag, addTagToNote, removeTagFromNote } = useTags();
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<typeof tags>([]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.trim()) {
      const filtered = tags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(value.toLowerCase()) &&
          !currentTags.some((ct) => ct.id === tag.id)
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleAddTag = async (tagName: string) => {
    const trimmedName = tagName.trim().toLowerCase();
    if (!trimmedName) return;

    try {
      // Check if tag already exists in current tags
      if (currentTags.some((t) => t.name === trimmedName)) {
        setInput("");
        setSuggestions([]);
        return;
      }

      // Create or find existing tag
      const tag = await createTag(trimmedName);

      // Add tag to note
      await addTagToNote({ noteId, tagId: tag.id });

      setInput("");
      setSuggestions([]);
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag(input);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromNote({ noteId, tagId });
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {currentTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1">
            {tag.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => handleRemoveTag(tag.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <div className="relative">
        <Input
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tags (press Enter)"
          className="w-full"
        />

        {suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleAddTag(tag.name)}
                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
