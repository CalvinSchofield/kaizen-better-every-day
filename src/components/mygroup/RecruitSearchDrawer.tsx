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
    
    const matches = recruits.filter((recruit) => {
      // Name search (case-insensitive)
      const nameMatch = recruit.name?.toLowerCase().includes(query);
      
      // Phone search (normalized digits)
      const phoneMatch = normalizedQuery.length >= 3 && 
        normalizePhone(recruit.phone).includes(normalizedQuery);
      
      return nameMatch || phoneMatch;
    });
    
    // Deduplicate by phone (primary) or name (fallback)
    const seen = new Set<string>();
    const deduped = matches.filter((recruit) => {
      const phoneKey = normalizePhone(recruit.phone);
      const nameKey = recruit.name?.toLowerCase().trim() || "";
      const key = phoneKey || nameKey;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return deduped.slice(0, 20);
  }, [recruits, searchQuery]);

  const handleSelect = (recruit: Recruit) => {
    onRecruitSelect(recruit);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>Search Recruits</DrawerTitle>
        </DrawerHeader>
        <div className="px-5 pb-6">
          <Command shouldFilter={false} className="rounded-xl border-0 bg-transparent">
            <div className="rounded-xl border bg-muted/30">
              <CommandInput
                placeholder="Search by name or phone..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                autoFocus
                className="h-12"
              />
            </div>
            <CommandList className="mt-3 max-h-[50vh]">
              {searchQuery.trim() === "" ? (
                <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                  Start typing to search...
                </CommandEmpty>
              ) : filteredRecruits.length === 0 ? (
                <CommandEmpty className="py-8">No recruits found.</CommandEmpty>
              ) : (
                <CommandGroup heading={`${filteredRecruits.length} result${filteredRecruits.length !== 1 ? 's' : ''}`} className="px-0">
                  {filteredRecruits.map((recruit) => (
                    <CommandItem
                      key={recruit.id}
                      value={recruit.id}
                      onSelect={() => handleSelect(recruit)}
                      className="flex items-center gap-3 py-3.5 px-3 cursor-pointer rounded-xl mb-1"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{recruit.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {recruit.teamName && <span className="truncate">{recruit.teamName}</span>}
                          {recruit.phone && (
                            <>
                              {recruit.teamName && <span>•</span>}
                              <span className="shrink-0">{recruit.phone}</span>
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
