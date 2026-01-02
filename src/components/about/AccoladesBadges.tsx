import { motion } from "framer-motion";
import { teamAccolades } from "@/data/aboutTeamData";
import { Trophy, Medal, Star, Crown } from "lucide-react";

const iconMap = {
  trophy: Trophy,
  medal: Medal,
  star: Star,
  crown: Crown
};

export const AccoladesBadges = () => {
  return (
    <section className="py-12 bg-background">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <h2 className="text-2xl font-bold mb-2">Team Accolades</h2>
          <p className="text-muted-foreground">
            A winning culture breeds winners.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-2 gap-4">
          {teamAccolades.map((accolade, index) => {
            const Icon = iconMap[accolade.icon];
            return (
              <motion.div
                key={accolade.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-5 text-center border border-amber-500/20"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-sm mb-1">
                  {accolade.title}
                </h3>
                {accolade.subtitle && (
                  <p className="text-xs text-muted-foreground">
                    {accolade.subtitle}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
