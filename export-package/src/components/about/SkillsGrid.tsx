import { motion } from "framer-motion";
import { transferableSkills } from "@/data/aboutTeamData";

export const SkillsGrid = () => {
  const categoryColors = {
    communication: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    mindset: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    execution: "bg-green-500/10 text-green-600 dark:text-green-400",
    leadership: "bg-orange-500/10 text-orange-600 dark:text-orange-400"
  };

  return (
    <section className="py-12 bg-muted/30">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2">Skills You'll Build</h2>
          <p className="text-muted-foreground">
            Skills CEOs and entrepreneurs wish they learned at your age.
          </p>
        </motion.div>
        
        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3">
          {transferableSkills.map((skill, index) => {
            const Icon = skill.icon;
            return (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-2xl p-4 ${categoryColors[skill.category]} border border-border/50`}
              >
                <Icon className="w-6 h-6 mb-2" />
                <h3 className="font-semibold text-sm text-foreground mb-1">
                  {skill.name}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {skill.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
