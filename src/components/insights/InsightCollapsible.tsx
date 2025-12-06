import { ChevronDown, LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface InsightCollapsibleProps {
  icon: LucideIcon;
  title: string;
  preview: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export const InsightCollapsible = ({
  icon: Icon,
  title,
  preview,
  isOpen,
  onToggle,
  children
}: InsightCollapsibleProps) => {
  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{title}</h2>
            </div>
            <ChevronDown 
              className={cn(
                "w-5 h-5 transition-transform duration-200 text-muted-foreground",
                isOpen && "rotate-180"
              )} 
            />
          </div>
          {!isOpen && (
            <div className="mt-2 text-left text-sm text-muted-foreground">
              {preview}
            </div>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
