import { motion } from "framer-motion";

interface ImageSlideProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt?: string;
  highlight?: string;
  overlayPosition?: 'top' | 'bottom' | 'center';
  statValue?: number;
  statLabel?: string;
}

export const ImageSlide = ({
  title,
  description,
  imageSrc,
  imageAlt = "",
  highlight,
  overlayPosition = 'bottom',
  statValue,
  statLabel,
}: ImageSlideProps) => {
  // Check if this is the hero-style welcome slide (has Kaizen title)
  const isHeroStyle = title === "Kaizen";

  if (isHeroStyle) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full h-full flex flex-col items-center pointer-events-none -mx-6"
      >
        {/* Background image */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.img
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6 }}
            src={imageSrc}
            alt={imageAlt}
            className="w-full h-full object-cover object-bottom"
          />
        </div>

        {/* Content overlay - centered */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 h-full">
          {/* Kaizen branding */}
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-bold text-white mb-1 drop-shadow-lg"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
          >
            {title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/90 font-medium text-lg mb-2 drop-shadow-md"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            Better Every Day.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white/80 text-sm max-w-[280px] italic mb-8 drop-shadow-md"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            A team built to develop elite performers — not just sell alarms.
          </motion.p>

          {/* Stat card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-black/30 backdrop-blur-md rounded-2xl px-8 py-5 border border-white/20"
          >
            <p className="text-4xl font-bold text-primary mb-1">
              $48,512
            </p>
            <p className="text-white/80 text-xs uppercase tracking-wider">
              Average Rookie Earnings
            </p>
          </motion.div>

          {/* Welcome message */}
          {highlight && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-white font-semibold text-lg drop-shadow-md"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              {highlight}
            </motion.p>
          )}
        </div>
      </motion.div>
    );
  }

  // Standard image slide layout
  const overlayClasses = {
    top: 'pt-8 pb-20 justify-start',
    center: 'py-8 justify-center',
    bottom: 'pt-20 pb-8 justify-end',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full h-full flex flex-col items-center pointer-events-none -mx-6"
    >
      {/* Background image */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6 }}
          src={imageSrc}
          alt={imageAlt}
          className="w-full h-full object-cover object-bottom"
        />
        {/* Gradient overlay */}
        <div className={`absolute inset-0 ${
          overlayPosition === 'bottom' 
            ? 'bg-gradient-to-t from-background via-background/80 to-transparent' 
            : overlayPosition === 'top'
            ? 'bg-gradient-to-b from-background via-background/80 to-transparent'
            : 'bg-background/60'
        }`} />
      </div>

      {/* Content */}
      <div className={`relative z-10 flex flex-col items-center text-center px-6 h-full ${overlayClasses[overlayPosition]}`}>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold mb-3"
        >
          {title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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
            className="mt-4 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
          >
            {highlight}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
