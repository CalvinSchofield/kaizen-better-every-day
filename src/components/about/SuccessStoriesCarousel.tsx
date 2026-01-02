import { motion } from "framer-motion";
import { successStories, dingDongDitchVideo } from "@/data/aboutTeamData";
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
        >
          <h2 className="text-2xl font-bold mb-2">Real Rookie Stories</h2>
          <p className="text-muted-foreground">
            No experience? No problem. They figured it out—so can you.
          </p>
        </motion.div>
      </div>
      
      {/* Ding Dong Ditch Video - Christian & Javier */}
      <div className="max-w-lg mx-auto px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl overflow-hidden bg-card border border-border"
        >
          <video 
            src={dingDongDitchVideo}
            controls
            playsInline
            className="w-full aspect-video object-cover"
          />
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Christian & Javier were caught ding-dong ditching Vivint doorbell cameras 6 months before selling them. Now they're top earners.
            </p>
          </div>
        </motion.div>
      </div>
      
      {/* Horizontal scroll carousel using embla */}
      <Carousel
        opts={{
          align: "start",
          dragFree: true,
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
