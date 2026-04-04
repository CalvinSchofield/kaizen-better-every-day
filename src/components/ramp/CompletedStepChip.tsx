import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletedStepChipProps {
  title: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const CompletedStepChip = ({ title, icon, onClick }: CompletedStepChipProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20",
        "text-sm font-medium text-primary transition-all",
        onClick && "hover:bg-primary/15 active:scale-[0.98] cursor-pointer"
      )}
    >
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span className="truncate">{title}</span>
      {onClick && <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />}
    </button>
  );
};

interface CompletedStepsRowProps {
  steps: Array<{ id: string; title: string; isComplete: boolean }>;
  onStepClick?: (id: string) => void;
}

export const CompletedStepsRow = ({ steps, onStepClick }: CompletedStepsRowProps) => {
  const completedSteps = steps.filter(s => s.isComplete);
  
  if (completedSteps.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Completed
      </p>
      <div className="flex flex-wrap gap-2">
        {completedSteps.map((step) => (
          <CompletedStepChip
            key={step.id}
            title={step.title}
            onClick={onStepClick ? () => onStepClick(step.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
};
