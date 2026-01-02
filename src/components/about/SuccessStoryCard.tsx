import { motion } from "framer-motion";
import { MessageCircle, User } from "lucide-react";
import { SuccessStory } from "@/data/aboutTeamData";

interface SuccessStoryCardProps {
  story: SuccessStory;
  index: number;
}

export const SuccessStoryCard = ({ story, index }: SuccessStoryCardProps) => {
  const hasPhoto = story.photo && !story.photo.includes('placeholder');
  const hasVideo = !!story.youtubeUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="flex-shrink-0 w-[85vw] max-w-[340px] snap-center"
    >
      <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-lg">
        {/* Photo / Video Section */}
        <div className="relative h-56 bg-muted">
          {hasVideo ? (
            // Inline YouTube embed
            <iframe
              src={`${story.youtubeUrl}?rel=0&modestbranding=1&playsinline=1`}
              title={`${story.name} testimonial`}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : hasPhoto ? (
            <img 
              src={story.photo} 
              alt={story.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <User className="w-20 h-20 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Name overlay - only show when no video */}
          {!hasVideo && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-5 py-4">
              <h3 className="text-white font-bold text-xl">{story.name}</h3>
              {story.earnings && (
                <span className="text-primary font-semibold text-sm">{story.earnings}</span>
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Name & earnings when video is shown */}
          {hasVideo && (
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground">{story.name}</h3>
              {story.earnings && (
                <span className="text-primary font-semibold text-sm">{story.earnings}</span>
              )}
            </div>
          )}
          
          {/* Hook */}
          <p className="font-bold text-lg text-foreground leading-snug">
            {story.hook}
          </p>
          
          {/* Story */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{story.beforeStory}</p>
            <p className="text-foreground">{story.afterResult}</p>
          </div>
          
          {/* Rhetorical Question */}
          <div className="bg-primary/10 rounded-2xl p-4 border-l-4 border-primary">
            <div className="flex items-start gap-2">
              <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-foreground italic">
                {story.rhetoricalQuestion}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
