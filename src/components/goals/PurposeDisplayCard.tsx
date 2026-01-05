import { Heart, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface PurposeDisplayCardProps {
  purposeStatement: string | null | undefined;
  purposeUpdatedAt?: string | null;
  title?: string;
  className?: string;
}

/**
 * Read-only display of a purpose statement for leaders viewing rep details
 */
export const PurposeDisplayCard = ({
  purposeStatement,
  purposeUpdatedAt,
  title = "Their Why",
  className,
}: PurposeDisplayCardProps) => {
  if (!purposeStatement) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-muted/50",
        className
      )}>
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No purpose statement set</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg bg-primary/5 border border-primary/20 p-4",
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Heart className="h-4 w-4 text-primary" />
        <h4 className="font-medium text-sm">{title}</h4>
      </div>
      
      <p className="text-sm italic leading-relaxed text-muted-foreground">
        "{purposeStatement}"
      </p>
      
      {purposeUpdatedAt && (
        <p className="text-xs text-muted-foreground mt-2">
          Set {format(parseISO(purposeUpdatedAt), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
};
