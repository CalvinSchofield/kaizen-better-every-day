import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Video {
  url: string;
  title: string;
  thumbnail: string;
  platform: "vimeo" | "instagram" | "youtube";
}

const videos: Video[] = [
  {
    url: "https://vimeo.com/651337313",
    title: "Sales Motivation",
    thumbnail: "https://i.vimeocdn.com/video/1305791234_295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/777489575",
    title: "Door to Door Success",
    thumbnail: "https://i.vimeocdn.com/video/1555086767_295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/742321231",
    title: "Mindset Training",
    thumbnail: "https://i.vimeocdn.com/video/1489742312_295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/683868546",
    title: "Sales Tips",
    thumbnail: "https://i.vimeocdn.com/video/1370458239_295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://www.instagram.com/case.studies.podcast/reel/DA99WUTPxnh/",
    title: "Sales Case Study",
    thumbnail: "https://scontent.cdninstagram.com/v/t51.29350-15/467467935_1097711615339629_3849388376689082378_n.jpg?_nc_cat=110&ccb=1-7&_nc_sid=18de74&_nc_ohc=4oK3vQZxVIgQ7kNvgFLqbfj&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=AUvNQyKjTNOWrqN0k3rJmcH&oh=00_AYA9nCJYHKLqN0k3rJmcH_VX6Z8d5c&oe=67633E5D",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DA7TVj5Nl3m/",
    title: "Motivation Reel",
    thumbnail: "https://scontent.cdninstagram.com/v/t51.29350-15/467195836_1318559959524062_8945627409865431071_n.jpg?_nc_cat=102&ccb=1-7&_nc_sid=18de74&_nc_ohc=n2rZ8qF8lVcQ7kNvgGE9Fqm&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=ANo9K5cEAAAA&oh=00_AYDqN0k3rJmcH_VX6Z8d5c&oe=67633F1E",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/CuzzGTXvvaj/",
    title: "Sales Strategy",
    thumbnail: "https://scontent.cdninstagram.com/v/t51.29350-15/369399849_651697003685437_8103821584038293758_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=18de74&_nc_ohc=9kRz7dF4sVwQ7kNvgH6L2DF&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=ANo9K5cEAAAA&oh=00_AYBqN0k3rJmcH_VX6Z8d5c&oe=67634A2C",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DBjhO7Gije3/",
    title: "Door Knocking Tips",
    thumbnail: "https://scontent.cdninstagram.com/v/t51.29350-15/470205869_600793272769733_3127404914563829401_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=18de74&_nc_ohc=8mVx3qF9mWcQ7kNvgFH3K8b&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=ANo9K5cEAAAA&oh=00_AYCqN0k3rJmcH_VX6Z8d5c&oe=67634B5F",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DC2FOTxRO8R/",
    title: "Success Stories",
    thumbnail: "https://scontent.cdninstagram.com/v/t51.29350-15/473190293_1108542854286889_6240869477945037091_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=18de74&_nc_ohc=7nQy2qF8oXcQ7kNvgG9M4Jk&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=ANo9K5cEAAAA&oh=00_AYDqN0k3rJmcH_VX6Z8d5c&oe=67634C8D",
    platform: "instagram"
  },
  {
    url: "https://youtu.be/nmwe8RmXXcY",
    title: "Sales Training",
    thumbnail: "https://img.youtube.com/vi/nmwe8RmXXcY/maxresdefault.jpg",
    platform: "youtube"
  }
];

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const MotivationalVideoCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledVideos, setShuffledVideos] = useState<Video[]>([]);
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());

  // Load watched videos from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('watchedMotivationalVideos');
    if (stored) {
      setWatchedVideos(new Set(JSON.parse(stored)));
    }
  }, []);

  // Shuffle videos on mount and when dependencies change
  useEffect(() => {
    setShuffledVideos(shuffleArray(videos));
  }, []);

  const handleVideoClick = (videoUrl: string) => {
    const newWatched = new Set(watchedVideos);
    newWatched.add(videoUrl);
    setWatchedVideos(newWatched);
    localStorage.setItem('watchedMotivationalVideos', JSON.stringify([...newWatched]));
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? shuffledVideos.length - 2 : prev - 2));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev >= shuffledVideos.length - 2 ? 0 : prev + 2));
  };

  if (shuffledVideos.length === 0) return null;

  const currentVideos = [
    shuffledVideos[currentIndex],
    shuffledVideos[(currentIndex + 1) % shuffledVideos.length]
  ];

  const watchedCount = watchedVideos.size;
  const totalCount = videos.length;
  const progressPercent = (watchedCount / totalCount) * 100;

  return (
    <div className="space-y-4">
      {/* Progress Tracker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your Progress</span>
          <span className="font-semibold text-foreground">{watchedCount} / {totalCount} watched</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      <div className="grid grid-cols-1 gap-3 animate-fade-in">
        {currentVideos.map((video, idx) => {
          const isWatched = watchedVideos.has(video.url);
          return (
            <a
              key={`${video.url}-${idx}`}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleVideoClick(video.url)}
              className="group block animate-scale-in"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <Card className="overflow-hidden hover:border-primary transition-all hover:shadow-lg">
                <div className="relative aspect-video bg-muted">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {isWatched && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-white font-semibold text-sm">{video.title}</span>
                      <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              </Card>
            </a>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevious}
          className="h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {Math.floor(currentIndex / 2) + 1} / {Math.ceil(shuffledVideos.length / 2)}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={goToNext}
          className="h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
