import { motion } from "framer-motion";
import { jobComparisons, earningStats } from "@/data/aboutTeamData";

export const EarningsComparison = () => {
  const maxEarnings = earningStats.teamRookieAverage;
  const companyPercent = (earningStats.companyRookieAverage / maxEarnings) * 100;
  
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
        
        {/* Combined comparison bar - Our Team vs Company Average */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-foreground">Our Team Rookies</span>
            <span className="font-bold text-primary">${earningStats.teamRookieAverage.toLocaleString()}</span>
          </div>
          <div className="relative h-10 rounded-full bg-primary overflow-hidden shadow-lg shadow-primary/20">
            {/* Company average marker inside the bar */}
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${companyPercent}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute top-0 left-0 h-full bg-primary/50 border-r-4 border-white/80"
            />
            {/* Label for company average - positioned on left side */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
              className="absolute top-0 left-3 h-full flex items-center"
            >
              <div className="bg-white/90 text-primary text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow">
                Avg Rookie $38k
              </div>
            </motion.div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Our rookies outpace the company average by 22%
          </p>
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
      </div>
    </section>
  );
};
