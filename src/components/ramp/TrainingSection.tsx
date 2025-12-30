import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TrainingSectionProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  isComplete: boolean;
  isLocked?: boolean;
  requiresLeader?: boolean;
  isWaitingVerification?: boolean;
  onTextLeader?: () => void;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const TrainingSection = ({
  title,
  icon,
  description,
  isComplete,
  isLocked,
  requiresLeader,
  isWaitingVerification,
  onTextLeader,
  isExpanded,
  onToggle,
  children,
}: TrainingSectionProps) => {
  // Show waiting state styling
  const showWaiting = isWaitingVerification && !isComplete;
  
  return (
    <Card className={cn(
      "transition-all duration-200 overflow-hidden rounded-2xl",
      isComplete && "bg-primary/5 border-primary/20",
      showWaiting && "bg-amber-500/5 border-amber-500/20",
      isLocked && "opacity-50"
    )}>
      <Collapsible open={isExpanded && !isLocked} onOpenChange={isLocked ? undefined : onToggle}>
        <CollapsibleTrigger asChild disabled={isLocked}>
          <CardContent className={cn("p-4", !isLocked && "cursor-pointer")}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isComplete ? (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                ) : showWaiting ? (
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <Circle className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-primary", showWaiting && "text-amber-600")}>{icon}</span>
                  <h4 className={cn(
                    "font-semibold text-sm",
                    isComplete && "text-muted-foreground",
                    showWaiting && "text-amber-700 dark:text-amber-500"
                  )}>
                    {title}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isLocked ? "Complete previous step to unlock" : showWaiting ? "Waiting on leader verification" : description}
                </p>
                {requiresLeader && !isLocked && !isComplete && !showWaiting && (
                  <Badge variant="outline" className="mt-2 text-xs rounded-lg">
                    Requires leader
                  </Badge>
                )}
                {requiresLeader && isComplete && (
                  <Badge variant="outline" className="mt-2 text-xs bg-green-500/10 border-green-500/30 text-green-700 rounded-lg">
                    ✓ Leader verified
                  </Badge>
                )}
                {showWaiting && onTextLeader && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTextLeader();
                    }}
                  >
                    <MessageSquare className="w-3 h-3 mr-1.5" />
                    Text Leader
                  </Button>
                )}
              </div>
              {!isLocked && (
                <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t">
            <div className="pt-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
