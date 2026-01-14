import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Plus, Clock, History, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChallenges } from "@/hooks/useChallenges";
import { ChallengeCard } from "./ChallengeCard";
import { CreateChallengeDrawer } from "./CreateChallengeDrawer";

type FilterTab = 'active' | 'pending' | 'history';

export const ChallengesTab = () => {
  const [filter, setFilter] = useState<FilterTab>('active');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  
  const { data: challenges, isLoading } = useChallenges(filter);

  const tabs: { key: FilterTab; label: string; icon: typeof Flame }[] = [
    { key: 'active', label: 'Active', icon: Flame },
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Challenges</h2>
        </div>
        <Button 
          size="sm" 
          onClick={() => setShowCreateDrawer(true)}
          className="gap-1.5"
          data-tour="create-challenge"
        >
          <Plus className="h-4 w-4" />
          Challenge
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !challenges?.length ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-card rounded-2xl border border-border"
        >
          <Swords className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground mb-1">
            {filter === 'active' && "No active challenges"}
            {filter === 'pending' && "No pending challenges"}
            {filter === 'history' && "No challenge history yet"}
          </p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            {filter === 'active' && "Challenge someone to get started!"}
            {filter === 'pending' && "All challenges have been responded to"}
            {filter === 'history' && "Your completed challenges will appear here"}
          </p>
          {filter !== 'history' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCreateDrawer(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Challenge
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3" data-tour="challenge-card">
            {challenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50, scale: 0.9, transition: { duration: 0.3, ease: "easeOut" } }}
                transition={{ delay: index * 0.05 }}
              >
                <ChallengeCard challenge={challenge} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Create Challenge Drawer */}
      <CreateChallengeDrawer 
        open={showCreateDrawer} 
        onOpenChange={setShowCreateDrawer} 
      />
    </div>
  );
};
