import { motion } from "framer-motion";
import { successStories } from "@/data/aboutTeamData";
import { SuccessStoryCard } from "./SuccessStoryCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

export const SuccessStoriesCarousel = () => {
  return (
    <section className="py-12 bg-background">
      <div className="max-w-lg mx-auto px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h2 className="text-2xl font-bold mb-2">Real Rookie Stories</h2>
          <p className="text-muted-foreground">
            No experience? No problem. They figured it out—so can you.
          </p>
        </motion.div>
      </div>
      
      {/* Horizontal scroll carousel with sticky snapping */}
      <Carousel
        opts={{
          align: "center",
          containScroll: "trimSnaps",
          skipSnaps: false,
        }}
        className="w-full"
      >
        <CarouselContent className="ml-4">
          {successStories.map((story, index) => (
            <CarouselItem key={story.id} className="basis-[85%] sm:basis-[70%] pl-0 pr-4">
              <SuccessStoryCard story={story} index={index} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};
