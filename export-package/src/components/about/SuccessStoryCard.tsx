import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, User, Play, ChevronDown, ChevronUp } from "lucide-react";
import { SuccessStory, dingDongDitchVideo } from "@/data/aboutTeamData";
import { BlurImage } from "@/components/ui/BlurImage";

interface SuccessStoryCardProps {
  story: SuccessStory;
  index: number;
}

export const SuccessStoryCard = ({ story, index }: SuccessStoryCardProps) => {
  const hasPhoto = story.photo && !story.photo.includes('placeholder');
  const hasVideo = !!story.youtubeUrl;
  const isChristian = story.id === "christian";
  const [showDingDong, setShowDingDong] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-shrink-0 w-full"
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
            <BlurImage
              src={story.photo}
              alt={story.name}
              loading="lazy"
              containerClassName="w-full h-full"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <User className="w-20 h-20 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Name overlay bar - always show */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-5 py-4">
            <h3 className="text-white font-bold text-xl">{story.name}</h3>
            {story.earnings && (
              <span className="text-primary font-semibold text-sm">{story.earnings}</span>
            )}
          </div>
        </div>
        
        {/* Expandable Ding Dong Ditch video for Christian */}
        {isChristian && (
          <div className="border-t border-border">
            <button
              onClick={() => setShowDingDong(!showDingDong)}
              className="w-full px-5 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Watch: Ding Dong Ditching Before Selling
                </span>
              </div>
              {showDingDong ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            
            <AnimatePresence>
              {showDingDong && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4">
                    <video 
                      src={dingDongDitchVideo}
                      controls
                      playsInline
                      className="w-full aspect-video object-cover rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Christian & Javier were caught ding-dong ditching Vivint cameras 6 months before selling them.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Content */}
        <div className="p-5 space-y-4">
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
