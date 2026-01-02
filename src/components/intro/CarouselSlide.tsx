import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface CarouselItem {
  photo: string;
  name: string;
}

interface CarouselSlideProps {
  title: string;
  description: string;
  carouselItems: CarouselItem[];
}

export const CarouselSlide = ({
  title,
  description,
  carouselItems,
}: CarouselSlideProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    const scrollSpeed = 0.5;

    const animate = () => {
      if (scrollContainer) {
        scrollContainer.scrollLeft += scrollSpeed;
        
        // Reset to start when reaching the middle (duplicated content)
        const halfWidth = scrollContainer.scrollWidth / 2;
        if (scrollContainer.scrollLeft >= halfWidth) {
          scrollContainer.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Duplicate items for seamless loop
  const duplicatedItems = [...carouselItems, ...carouselItems];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8 pointer-events-none w-full"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-bold mb-3"
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-muted-foreground text-base max-w-xs leading-relaxed mb-8"
      >
        {description}
      </motion.p>

      {/* Horizontal scrolling carousel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-screen -mx-6"
      >
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-hidden px-6"
          style={{ scrollBehavior: 'auto' }}
        >
          {duplicatedItems.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex flex-col items-center flex-shrink-0"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 mb-2">
                <img
                  src={item.photo}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
