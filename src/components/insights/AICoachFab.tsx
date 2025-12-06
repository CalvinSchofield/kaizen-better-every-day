import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

export const AICoachFab = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary-dark transition-all duration-200 hover:scale-105"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* AI Coach Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh]">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <SheetTitle className="text-xl">AI Coach</SheetTitle>
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
              </div>
            </div>
          </SheetHeader>
          
          <div className="space-y-4 pb-8">
            <div className="p-5 rounded-2xl bg-muted/50 border border-border/50">
              <p className="text-muted-foreground leading-relaxed">
                AI Coach will analyze your numbers to show what you're doing well and where to focus. 
                No more guessing—just clear, data-driven coaching to help you improve.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">Strengths</div>
                <div className="text-lg font-semibold text-success">Coming soon</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">Focus Areas</div>
                <div className="text-lg font-semibold text-warning">Coming soon</div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
