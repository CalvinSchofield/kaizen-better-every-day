import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIncentives } from "@/hooks/useIncentives";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { IncentiveCard } from "./IncentiveCard";
import { CreateIncentiveDrawer } from "./CreateIncentiveDrawer";

type FilterTab = 'active' | 'history';

export const IncentivesTab = () => {
  const [filter, setFilter] = useState<FilterTab>('active');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  
  const { data: incentives, isLoading } = useIncentives(filter);
  const { data: teamAccess } = useTeamAccess();

  const isLeader = teamAccess?.accessLevel !== 'none';

  const tabs: { key: FilterTab; label: string; icon: typeof Trophy }[] = [
    { key: 'active', label: 'Active', icon: Trophy },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-lg">Incentives</h2>
        </div>
        {isLeader && (
          <Button 
            size="sm" 
            onClick={() => setShowCreateDrawer(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Incentive
          </Button>
        )}
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
      ) : !incentives?.length ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-card rounded-2xl border border-border"
        >
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground mb-1">
            {filter === 'active' && "No active incentives"}
            {filter === 'history' && "No incentive history yet"}
          </p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            {filter === 'active' && (isLeader 
              ? "Create an incentive to motivate your team!" 
              : "Check back later for leader incentives")}
            {filter === 'history' && "Completed incentives will appear here"}
          </p>
          {filter === 'active' && isLeader && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCreateDrawer(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Incentive
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {incentives.map((incentive, index) => (
              <motion.div
                key={incentive.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <IncentiveCard incentive={incentive} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Create Incentive Drawer (Leaders Only) */}
      {isLeader && (
        <CreateIncentiveDrawer 
          open={showCreateDrawer} 
          onOpenChange={setShowCreateDrawer} 
        />
      )}
    </div>
  );
};
