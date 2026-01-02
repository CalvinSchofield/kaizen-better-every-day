import { motion } from "framer-motion";
import { earningStats, bigWins } from "@/data/aboutTeamData";
import { Zap, DollarSign, Home } from "lucide-react";

export const BigWinsShowcase = () => {
  return (
    <section className="py-12 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2">Record-Breaking Days</h2>
          <p className="text-muted-foreground">
            What's possible when you go all in.
          </p>
        </motion.div>
        
        {/* Big number callouts */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-card rounded-3xl p-5 text-center border border-border shadow-sm"
          >
            <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
            <div className="text-3xl font-bold text-foreground mb-1">
              ${earningStats.biggestDay.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Biggest Day
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-3xl p-5 text-center border border-border shadow-sm"
          >
            <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-foreground mb-1">
              ${earningStats.biggestWeek.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Biggest Week
            </div>
          </motion.div>
        </div>
        
        {/* Real purchases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            What Rookies Built
          </h3>
        </motion.div>
        
        <div className="space-y-3">
          {bigWins.map((win, index) => (
            <motion.div
              key={win.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-card rounded-2xl p-4 border border-border flex gap-4"
            >
              {win.photo ? (
                <img 
                  src={win.photo} 
                  alt={win.name}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Home className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">{win.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {win.achievement}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
