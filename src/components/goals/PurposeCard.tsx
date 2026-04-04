import { useState } from "react";
import { Heart, ChevronDown, ChevronUp, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface PurposeCardProps {
  purposeStatement: string | null;
  purposeUpdatedAt?: string | null;
  onEdit?: () => void;
  variant?: 'compact' | 'full';
  className?: string;
}

export const PurposeCard = ({
  purposeStatement,
  purposeUpdatedAt,
  onEdit,
  variant = 'compact',
  className,
}: PurposeCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!purposeStatement) {
    if (variant === 'compact') return null;
    
    return (
      <div className={cn(
        "rounded-xl bg-muted/50 border border-border p-4",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Heart className="h-4 w-4" />
            <span className="text-sm">No purpose statement set</span>
          </div>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Set Purpose
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn(
        "rounded-xl bg-primary/5 border border-primary/20 overflow-hidden",
        className
      )}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">Your Why</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-sm italic leading-relaxed">
              "{purposeStatement}"
            </p>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="w-full text-xs"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Edit Purpose
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn(
      "rounded-xl bg-primary/5 border border-primary/20 p-4",
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Heart className="h-4 w-4 text-primary" />
        <span className="font-medium text-primary">Your Why</span>
      </div>
      
      <p className="text-sm italic leading-relaxed mb-3">
        "{purposeStatement}"
      </p>
      
      <div className="flex items-center justify-between">
        {purposeUpdatedAt && (
          <span className="text-xs text-muted-foreground">
            Set {format(parseISO(purposeUpdatedAt), 'MMM d, yyyy')}
          </span>
        )}
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );
};
