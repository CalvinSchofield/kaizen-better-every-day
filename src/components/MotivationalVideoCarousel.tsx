import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    thumbnail: "https://i.vimeocdn.com/video/1305791234-5f7d7e4e4b5b6c0e7f8e9f0e1f2f3f4f5f6f7f8f9/295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/777489575",
    title: "Door to Door Success",
    thumbnail: "https://i.vimeocdn.com/video/1555555555-5f7d7e4e4b5b6c0e7f8e9f0e1f2f3f4f5f6f7f8f9/295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/742321231",
    title: "Mindset Training",
    thumbnail: "https://i.vimeocdn.com/video/1444444444-5f7d7e4e4b5b6c0e7f8e9f0e1f2f3f4f5f6f7f8f9/295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/683868546",
    title: "Sales Tips",
    thumbnail: "https://i.vimeocdn.com/video/1333333333-5f7d7e4e4b5b6c0e7f8e9f0e1f2f3f4f5f6f7f8f9/295x166.jpg",
    platform: "vimeo"
  },
  {
    url: "https://www.instagram.com/case.studies.podcast/reel/DA99WUTPxnh/",
    title: "Sales Case Study",
    thumbnail: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DA7TVj5Nl3m/",
    title: "Motivation Reel",
    thumbnail: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/CuzzGTXvvaj/",
    title: "Sales Strategy",
    thumbnail: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=300&fit=crop",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DBjhO7Gije3/",
    title: "Door Knocking Tips",
    thumbnail: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DC2FOTxRO8R/",
    title: "Success Stories",
    thumbnail: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=300&fit=crop",
    platform: "instagram"
  },
  {
    url: "https://youtu.be/nmwe8RmXXcY",
    title: "Sales Training",
    thumbnail: "https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=400&h=300&fit=crop",
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

  // Shuffle videos on mount and when dependencies change
  useEffect(() => {
    setShuffledVideos(shuffleArray(videos));
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 animate-fade-in">
        {currentVideos.map((video, idx) => (
          <a
            key={`${video.url}-${idx}`}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-white font-semibold text-sm">{video.title}</span>
                    <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </Card>
          </a>
        ))}
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
