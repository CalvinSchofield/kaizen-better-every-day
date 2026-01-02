import { motion } from "framer-motion";
import { teamAccolades } from "@/data/aboutTeamData";
import { Trophy, Medal, Star, Crown } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  medal: Medal,
  star: Star,
  crown: Crown
};

interface AccoladesSlideProps {
  title: string;
  description: string;
}

export const AccoladesSlide = ({ title, description }: AccoladesSlideProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-4 py-4 pointer-events-none w-full"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-bold mb-2"
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-6"
      >
        {description}
      </motion.p>

      {/* 2x2 Grid of accolades */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-3 w-full max-w-xs"
      >
        {teamAccolades.map((accolade, index) => {
          const Icon = iconMap[accolade.icon] || Trophy;
          return (
            <motion.div
              key={accolade.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-4 text-center border border-amber-500/20"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-amber-500/20">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-foreground text-xs mb-0.5">
                {accolade.title}
              </h3>
              {accolade.subtitle && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {accolade.subtitle}
                </p>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
};
