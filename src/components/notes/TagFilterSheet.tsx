import { useTags } from "@/hooks/useTags";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";

interface TagFilterSheetProps {
  selectedTags: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export const TagFilterSheet = ({ selectedTags, onTagsChange }: TagFilterSheetProps) => {
  const { tags } = useTags();

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          {selectedTags.length > 0 && `(${selectedTags.length})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Filter by Tags</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags yet. Add tags to your notes to filter them.
            </p>
          ) : (
            <>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2">
                    <Checkbox
                      id={tag.id}
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={() => handleToggleTag(tag.id)}
                    />
                    <Label htmlFor={tag.id} className="flex-1 cursor-pointer">
                      {tag.name}
                    </Label>
                  </div>
                ))}
              </div>

              {selectedTags.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  className="w-full"
                >
                  Clear All
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
