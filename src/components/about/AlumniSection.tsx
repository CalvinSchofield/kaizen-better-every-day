import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { alumniStories, AlumniStory } from "@/data/aboutTeamData";
import { Rocket, User, ChevronDown, ChevronUp, X, MessageSquare, Home } from "lucide-react";
import { BlurImage } from "@/components/ui/BlurImage";

interface ExpandableModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  caption?: string;
}

const ExpandableImageModal = ({ isOpen, onClose, imageUrl, caption }: ExpandableModalProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-lg w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 text-white/80 hover:text-white p-2"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={imageUrl}
            alt={caption || "Expanded image"}
            className="w-full h-auto rounded-xl"
          />
          {caption && (
            <p className="text-white/80 text-center mt-3 text-sm">{caption}</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

interface AlumniCardProps {
  alumni: AlumniStory;
  index: number;
}

const AlumniCard = ({ alumni, index }: AlumniCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  
  const hasExpandableContent = alumni.expandableContent || alumni.expandableImage;
  const isJosh = alumni.id === "josh";
  const isMisael = alumni.id === "misael";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1, duration: 0.4 }}
        className="bg-card rounded-2xl border border-border overflow-hidden"
      >
        <div className="p-5">
          <div className="flex gap-4">
            {alumni.photo ? (
              <div 
                className={isMisael ? "cursor-pointer" : ""}
                onClick={() => isMisael && setShowImageModal(true)}
              >
                <BlurImage
                  src={alumni.photo}
                  alt={alumni.name}
                  loading="lazy"
                  containerClassName="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground">{alumni.name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <Rocket className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm text-primary font-medium">
                  {alumni.currentRole}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {alumni.story}
              </p>
            </div>
          </div>
        </div>
        
        {/* Expandable toggle for Josh and Misael */}
        {hasExpandableContent && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-5 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors border-t border-border"
            >
              <div className="flex items-center gap-2">
                {isJosh ? (
                  <MessageSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Home className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {isJosh ? "Read Josh's Message" : "See the House"}
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-3">
                    {alumni.expandableContent && (
                      <p className={`text-sm ${isJosh ? "italic text-foreground bg-muted/50 p-3 rounded-xl" : "text-muted-foreground"}`}>
                        {alumni.expandableContent}
                      </p>
                    )}
                    
                    {alumni.expandableImage && (
                      <div 
                        className="mt-3 cursor-pointer"
                        onClick={() => setShowImageModal(true)}
                      >
                        <BlurImage
                          src={alumni.expandableImage}
                          alt={alumni.expandableImageCaption || "Expanded content"}
                          loading="lazy"
                          containerClassName="w-full aspect-[4/3] rounded-xl overflow-hidden"
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          {alumni.expandableImageCaption} • Tap to expand
                        </p>
                      </div>
                    )}
                    
                    {/* Josh's text screenshot */}
                    {isJosh && (
                      <BlurImage
                        src="/images/about-team/josh-text.png"
                        alt="Josh's thank you text"
                        loading="lazy"
                        containerClassName="w-full rounded-lg border border-border mt-3 overflow-hidden"
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
      
      {/* Image Modal */}
      <ExpandableImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        imageUrl={alumni.expandableImage || alumni.photo || ""}
        caption={alumni.expandableImageCaption}
      />
    </>
  );
};

export const AlumniSection = () => {
  return (
    <section className="py-12 bg-muted/30">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2">Where Are They Now?</h2>
          <p className="text-muted-foreground">
            This summer sets up your future. See what past reps built.
          </p>
        </motion.div>
        
        <div className="space-y-4">
          {alumniStories.map((alumni, index) => (
            <AlumniCard key={alumni.id} alumni={alumni} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};
