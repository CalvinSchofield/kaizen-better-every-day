import { motion } from "framer-motion";
import { successStories } from "@/data/aboutTeamData";
import { SuccessStoryCard } from "./SuccessStoryCard";

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
      
      {/* Horizontal scroll carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {successStories.map((story, index) => (
          <SuccessStoryCard key={story.id} story={story} index={index} />
        ))}
      </div>
    </section>
  );
};
