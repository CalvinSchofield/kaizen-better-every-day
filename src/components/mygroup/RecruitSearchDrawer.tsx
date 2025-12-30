import { useState, useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Recruit } from "@/hooks/useGroupRecruits";
import { User } from "lucide-react";

interface RecruitSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruits: Recruit[];
  onRecruitSelect: (recruit: Recruit) => void;
}

const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
};

const getStageColor = (stage: string | null | undefined): string => {
  if (!stage) return "bg-muted text-muted-foreground";
  const lower = stage.toLowerCase();
  if (lower.includes("sold")) return "bg-success/20 text-success";
  if (lower.includes("shadow")) return "bg-primary/20 text-primary";
  if (lower.includes("signed")) return "bg-warning/20 text-warning-foreground";
  if (lower.includes("evaluating")) return "bg-blue-500/20 text-blue-600";
  if (lower.includes("reached")) return "bg-purple-500/20 text-purple-600";
  return "bg-muted text-muted-foreground";
};

export const RecruitSearchDrawer = ({
  open,
  onOpenChange,
  recruits,
  onRecruitSelect,
}: RecruitSearchDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecruits = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const normalizedQuery = normalizePhone(query);
    
    return recruits.filter((recruit) => {
      // Name search (case-insensitive)
      const nameMatch = recruit.name?.toLowerCase().includes(query);
      
      // Phone search (normalized digits)
      const phoneMatch = normalizedQuery.length >= 3 && 
        normalizePhone(recruit.phone).includes(normalizedQuery);
      
      return nameMatch || phoneMatch;
    }).slice(0, 20); // Limit results for performance
  }, [recruits, searchQuery]);

  const handleSelect = (recruit: Recruit) => {
    onRecruitSelect(recruit);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle>Search Recruits</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-2">
          <Command shouldFilter={false} className="rounded-lg border">
            <CommandInput
              placeholder="Search by name or phone..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoFocus
            />
            <CommandList>
              {searchQuery.trim() === "" ? (
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  Start typing to search...
                </CommandEmpty>
              ) : filteredRecruits.length === 0 ? (
                <CommandEmpty>No recruits found.</CommandEmpty>
              ) : (
                <CommandGroup heading={`${filteredRecruits.length} result${filteredRecruits.length !== 1 ? 's' : ''}`}>
                  {filteredRecruits.map((recruit) => (
                    <CommandItem
                      key={recruit.id}
                      value={recruit.id}
                      onSelect={() => handleSelect(recruit)}
                      className="flex items-center gap-3 py-3 cursor-pointer"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{recruit.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {recruit.teamName && <span>{recruit.teamName}</span>}
                          {recruit.phone && (
                            <>
                              {recruit.teamName && <span>•</span>}
                              <span>{recruit.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {recruit.stage && (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs shrink-0 ${getStageColor(recruit.stage)}`}
                        >
                          {recruit.stage}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
