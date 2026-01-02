import { motion } from "framer-motion";

interface ImageSlideProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt?: string;
  highlight?: string;
  overlayPosition?: 'top' | 'bottom' | 'center';
}

export const ImageSlide = ({
  title,
  description,
  imageSrc,
  imageAlt = "",
  highlight,
  overlayPosition = 'bottom',
}: ImageSlideProps) => {
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
