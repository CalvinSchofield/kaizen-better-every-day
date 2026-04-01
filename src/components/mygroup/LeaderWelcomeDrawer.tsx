import { useState } from "react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Users, Send, Sparkles, ChevronRight, Network } from "lucide-react";

interface LeaderWelcomeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGetStarted: () => void;
}

const STEPS = [
  {
    icon: Network,
    title: "Build Your Structure",
    description: "Create your teams and management groups so everything mirrors your real org. Tap the grid icon at the top right to get started.",
  },
  {
    icon: Send,
    title: "Invite Your Leaders",
    description: "Once your structure is set, use the + button to send invite links to your sub-leaders. They'll get their own guided setup.",
  },
  {
    icon: Users,
    title: "They Build Their Teams",
    description: "When your leaders join, they'll set up their own teams and invite their reps — no extra work for you.",
  },
];

export const LeaderWelcomeDrawer = ({ open, onOpenChange, onGetStarted }: LeaderWelcomeDrawerProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <Sparkles className="h-6 w-6 text-primary" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground">Time to Build Your Org</h2>
            <p className="text-sm text-muted-foreground">
              Here's how to get your team set up in 3 easy steps
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.12 }}
                className="flex gap-3 items-start"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold text-primary">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Button className="w-full gap-2" onClick={onGetStarted}>
              Let's Go
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
