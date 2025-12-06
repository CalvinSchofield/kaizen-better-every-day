import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';

export const LeaderAICoachFab = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Leader AI Coach Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <DrawerTitle className="text-xl">AI Coach</DrawerTitle>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
          </DrawerHeader>
          
          <div className="px-4 space-y-4 pb-8">
            <div className="p-5 rounded-2xl bg-muted/50 border border-border/50">
              <p className="text-muted-foreground leading-relaxed">
                AI Coach will help you understand your team's performance and identify coaching opportunities—no more guessing. 
                Data-driven insights to help your team get better.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">Team Strengths</div>
                <div className="text-lg font-semibold text-success">Coming soon</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">Coaching Focus</div>
                <div className="text-lg font-semibold text-warning">Coming soon</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/50">
              <div className="text-sm text-muted-foreground mb-1">Compare Performance</div>
              <div className="text-sm text-muted-foreground">
                Compare your team vs other teams or MGMT groups
              </div>
              <div className="text-lg font-semibold text-primary mt-1">Coming soon</div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
