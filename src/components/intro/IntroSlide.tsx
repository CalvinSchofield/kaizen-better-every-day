import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface IntroSlideProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  description: string;
  highlight?: string;
}

export const IntroSlide = ({ 
  icon: Icon, 
  iconColor = "text-primary",
  title, 
  description,
  highlight
}: IntroSlideProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8 h-full"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className={`w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6`}
      >
        <Icon className={`w-10 h-10 ${iconColor}`} />
      </motion.div>
      
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold mb-3"
      >
        {title}
      </motion.h2>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-base max-w-xs leading-relaxed"
      >
        {description}
      </motion.p>
      
      {highlight && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
        >
          {highlight}
        </motion.div>
      )}
    </motion.div>
  );
};
