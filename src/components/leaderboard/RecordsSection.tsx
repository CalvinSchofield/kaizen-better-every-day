import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PersonalBestsSection } from "./PersonalBestsSection";
import { ClassRecordsSection } from "./ClassRecordsSection";
import { cn } from "@/lib/utils";

interface RecordsSectionProps {
  userId: string | null;
}

export const RecordsSection = ({ userId }: RecordsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Records</h2>
            <span className="text-xs text-muted-foreground">(Personal Bests & Class Records)</span>
          </div>
          <ChevronDown 
            className={cn(
              "w-5 h-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 space-y-6">
        <PersonalBestsSection userId={userId} />
        <ClassRecordsSection currentUserId={userId} />
      </CollapsibleContent>
    </Collapsible>
  );
};
