import { motion } from "framer-motion";
import { heroContent } from "@/data/aboutTeamData";
import { useEffect, useState } from "react";

export const HeroSection = () => {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = 48512;

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = targetValue / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetValue) {
        setDisplayValue(targetValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative h-[85vh] min-h-[500px] overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-bottom"
        style={{ backgroundImage: `url(${heroContent.backgroundImage})` }}
      />
      
      {/* Dark Overlay with gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center text-white">
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-6xl font-bold mb-2"
        >
          {heroContent.title}
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-2xl md:text-3xl font-medium text-white/90 mb-4"
        >
          {heroContent.tagline}
        </motion.p>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-base md:text-lg text-white/70 mb-10 max-w-sm"
        >
          {heroContent.subheadline}
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="bg-white/10 backdrop-blur-md rounded-3xl px-8 py-6 border border-white/20"
        >
          <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
            ${displayValue.toLocaleString()}
          </div>
          <div className="text-sm text-white/70 uppercase tracking-wider">
            {heroContent.statLabel}
          </div>
        </motion.div>
        
        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-3 rounded-full bg-white/60" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
