import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PersonalBestsSection } from "./PersonalBestsSection";
import { ClassRecordsSection } from "./ClassRecordsSection";
import { cn } from "@/lib/utils";
import type { RecordsMetric } from "@/hooks/useRecordsTracking";

interface RecordsSectionProps {
  userId: string | null;
}

export const RecordsSection = ({ userId }: RecordsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [metric, setMetric] = useState<RecordsMetric>('fp');

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
        <div className="flex justify-end">
          <div className="flex bg-muted rounded-full p-0.5">
            <button
              onClick={() => setMetric('fp')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                metric === 'fp'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              FP+
            </button>
            <button
              onClick={() => setMetric('prmr')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                metric === 'prmr'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              PRMR
            </button>
          </div>
        </div>
        <PersonalBestsSection userId={userId} metric={metric} />
        <ClassRecordsSection currentUserId={userId} metric={metric} />
      </CollapsibleContent>
    </Collapsible>
  );
};
