import { motion } from "framer-motion";
import { Play, X } from "lucide-react";
import { useState } from "react";

interface VideoSlideProps {
  title: string;
  description: string;
  videoThumbnail?: string;
  videoUrl?: string;
}

export const VideoSlide = ({
  title,
  description,
  videoThumbnail,
  videoUrl,
}: VideoSlideProps) => {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8"
    >
      {/* Video thumbnail with play button */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="relative w-48 h-48 mb-6 rounded-2xl overflow-hidden bg-muted cursor-pointer pointer-events-auto"
        onClick={() => videoUrl && setShowVideo(true)}
      >
        {videoThumbnail ? (
          <img
            src={videoThumbnail}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40" />
        )}
        
        {/* Play button overlay */}
        {videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
            </div>
          </div>
        )}
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold mb-3"
      >
        "{title}"
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-base max-w-xs leading-relaxed italic"
      >
        {description}
      </motion.p>

      {videoUrl && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => setShowVideo(true)}
          className="mt-4 text-primary text-sm font-medium pointer-events-auto"
        >
          Tap to watch their story →
        </motion.button>
      )}

      {/* Video modal */}
      {showVideo && videoUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 pointer-events-auto"
          onClick={() => setShowVideo(false)}
        >
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div 
            className="w-full max-w-lg aspect-video rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${videoUrl}?autoplay=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
