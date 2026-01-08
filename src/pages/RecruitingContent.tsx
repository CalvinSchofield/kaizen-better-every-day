import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Play, Mic, Globe, Image, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { EdgeSwipeContainer } from "@/components/EdgeSwipeContainer";
import { 
  recruitingContent, 
  ContentCategory, 
  CATEGORY_LABELS, 
  getCategoryCount,
  getContentByCategory,
  type RecruitingContent as ContentType 
} from "@/data/recruitingContentData";

// Import images for the gallery
import rookieToRegional from "@/assets/recruiting/rookie-to-regional.webp";
import sixFiguresComparison from "@/assets/recruiting/six-figures-comparison.webp";
import nrgVsSunrun from "@/assets/recruiting/nrg-vs-sunrun.webp";

const imageMap: Record<string, string> = {
  '/src/assets/recruiting/rookie-to-regional.webp': rookieToRegional,
  '/src/assets/recruiting/six-figures-comparison.webp': sixFiguresComparison,
  '/src/assets/recruiting/nrg-vs-sunrun.webp': nrgVsSunrun,
};

const categories: ContentCategory[] = ['all', 'long-video', 'short-video', 'podcast', 'website', 'image'];

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'youtube':
    case 'vimeo':
    case 'instagram':
      return <Play className="h-4 w-4" />;
    case 'spotify':
    case 'apple-podcasts':
      return <Mic className="h-4 w-4" />;
    case 'web':
      return <Globe className="h-4 w-4" />;
    case 'image':
      return <Image className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
};

const getPlatformLabel = (platform: string) => {
  switch (platform) {
    case 'youtube': return 'YouTube';
    case 'vimeo': return 'Vimeo';
    case 'instagram': return 'Instagram';
    case 'spotify': return 'Spotify';
    case 'apple-podcasts': return 'Apple Podcasts';
    case 'web': return 'Website';
    case 'image': return 'Image';
    default: return platform;
  }
};

const getCategoryColor = (category: ContentCategory) => {
  switch (category) {
    case 'long-video': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'short-video': return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
    case 'podcast': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'website': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'image': return 'bg-green-500/10 text-green-600 border-green-500/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export default function RecruitingContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<ContentCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const filteredContent = getContentByCategory(activeCategory);

  const handleCopy = async (item: ContentType) => {
    try {
      if (item.category === 'image' && item.imagePath) {
        // For images, copy a message about the image
        await navigator.clipboard.writeText(`Check out this: ${item.title} - ${item.description}`);
      } else {
        await navigator.clipboard.writeText(item.url);
      }
      
      setCopiedId(item.id);
      toast({
        title: "Copied!",
        description: item.category === 'image' ? "Image info copied" : "Link copied to clipboard",
      });
      
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleImageClick = (imagePath: string) => {
    setSelectedImage(imagePath);
  };

  return (
    <EdgeSwipeContainer>
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border"
        style={{ paddingTop: 'var(--effective-safe-area-top)' }}
      >
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Recruiting Content</h1>
            <p className="text-sm text-muted-foreground">Tap to copy and share</p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {CATEGORY_LABELS[category]}
              <span className="ml-1.5 opacity-70">
                {getCategoryCount(category)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-4 space-y-3 pb-24">
        <AnimatePresence mode="popLayout">
          {filteredContent.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.03 }}
            >
              {item.category === 'image' ? (
                // Image Card
                <Card 
                  className="overflow-hidden rounded-2xl border-border/50 active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => item.imagePath && handleImageClick(imageMap[item.imagePath])}
                >
                  <div className="relative">
                    {item.imagePath && (
                      <img 
                        src={imageMap[item.imagePath]} 
                        alt={item.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="text-sm text-white/80">{item.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-3 right-3 rounded-full h-10 w-10 p-0 bg-white/90 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item);
                      }}
                    >
                      {copiedId === item.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-foreground" />
                      )}
                    </Button>
                  </div>
                </Card>
              ) : (
                // Link Card
                <Card 
                  className="p-4 rounded-2xl border-border/50 active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => handleCopy(item)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryColor(item.category as ContentCategory)}`}>
                      {getPlatformIcon(item.platform)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                      <span className="inline-block mt-2 text-xs font-medium text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full">
                        {getPlatformLabel(item.platform)}
                      </span>
                    </div>

                    {/* Copy Button */}
                    <div className="flex-shrink-0">
                      {copiedId === item.id ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Copy className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-2xl"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white text-lg font-medium"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </EdgeSwipeContainer>
  );
}
