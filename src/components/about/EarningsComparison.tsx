import { motion } from "framer-motion";
import { jobComparisons, earningStats } from "@/data/aboutTeamData";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";

export const EarningsComparison = () => {
  const maxEarnings = earningStats.teamRookieAverage;
  
  return (
    <section className="py-12 bg-background">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2">Your Summer vs. Theirs</h2>
          <p className="text-muted-foreground">
            Same 4 months. Different results.
          </p>
        </motion.div>
        
        {/* Our team bar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-foreground">Our Team Rookies*</span>
            <span className="font-bold text-primary">${earningStats.teamRookieAverage.toLocaleString()}</span>
          </div>
          <div className="h-8 rounded-full bg-primary overflow-hidden shadow-lg shadow-primary/20" />
        </motion.div>
        
        {/* Comparison bars */}
        <div className="space-y-3">
          {jobComparisons.map((job, index) => {
            const widthPercent = (job.earnings / maxEarnings) * 100;
            return (
              <motion.div
                key={job.job}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">{job.job}</span>
                  <span className="text-sm text-muted-foreground">${job.earnings.toLocaleString()}</span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${widthPercent}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: index * 0.05 }}
                    className="h-full rounded-full bg-muted-foreground/30"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        
        <PayEstimateDisclaimer className="mt-6 text-center" />
      </div>
    </section>
  );
};
