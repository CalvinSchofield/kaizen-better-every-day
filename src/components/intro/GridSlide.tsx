import { motion } from "framer-motion";

interface GridItem {
  photo: string;
  name: string;
  isAreaDirector?: boolean;
}

interface GridSlideProps {
  title: string;
  description: string;
  gridItems: GridItem[];
}

export const GridSlide = ({
  title,
  description,
  gridItems,
}: GridSlideProps) => {
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
        className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-4"
      >
        {description}
      </motion.p>

      {/* 3x5 Grid of leaders */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-3 w-full max-w-xs"
      >
        {gridItems.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + index * 0.03 }}
            className="text-center"
          >
            <div className={`w-16 h-16 mx-auto rounded-full overflow-hidden border-2 ${
              item.isAreaDirector ? 'border-primary ring-2 ring-primary/30' : 'border-border'
            } bg-muted`}>
              <img
                src={item.photo}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
            <p className="text-[10px] font-medium mt-1 leading-tight truncate px-1">
              {item.name.split(' ')[0]}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};
