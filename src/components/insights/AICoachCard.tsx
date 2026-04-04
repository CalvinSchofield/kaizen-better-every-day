import { Sparkles, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AICoachCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const AICoachCard = ({ isOpen, onToggle }: AICoachCardProps) => {
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">AI Coach</h2>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
          </div>
          {!isOpen && (
            <div className="mt-2 text-left text-sm text-muted-foreground">
              Personalized coaching insights based on your numbers
            </div>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI Coach will analyze your numbers to show what you're doing well and where to focus. 
                No more guessing—just clear, data-driven coaching to help you improve.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
