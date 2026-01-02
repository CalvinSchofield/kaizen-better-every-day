import { motion } from "framer-motion";
import { quickStats, earningStats } from "@/data/aboutTeamData";
import { TrendingUp } from "lucide-react";

export const QuickStatsBar = () => {
  return (
    <section className="py-6 bg-muted/30">
      <div className="max-w-lg mx-auto px-4">
        {/* Comparison badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-2 mb-4"
        >
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className="text-sm text-muted-foreground">
            <span className="text-green-500 font-semibold">+{earningStats.percentAboveAverage}%</span> above company rookie average
          </span>
        </motion.div>
        
        {/* Horizontal scroll stats */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {quickStats.map((stat, index) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`flex-shrink-0 rounded-2xl px-5 py-4 text-center min-w-[120px] ${
                stat.highlight 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-card border border-border'
              }`}
            >
              <div className={`text-2xl font-bold mb-1 ${
                stat.highlight ? '' : 'text-foreground'
              }`}>
                {stat.value}
              </div>
              <div className={`text-xs ${
                stat.highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'
              }`}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
