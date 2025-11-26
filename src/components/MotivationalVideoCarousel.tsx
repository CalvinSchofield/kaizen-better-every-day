import { useState, useEffect } from "react";
import { Play } from "lucide-react";
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
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/777489575",
    title: "Door to Door Success",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/742321231",
    title: "Mindset Training",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/683868546",
    title: "Sales Tips",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://www.instagram.com/case.studies.podcast/reel/DA99WUTPxnh/",
    title: "Sales Case Study",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DA7TVj5Nl3m/",
    title: "Motivation Reel",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/CuzzGTXvvaj/",
    title: "Sales Strategy",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DBjhO7Gije3/",
    title: "Door Knocking Tips",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DC2FOTxRO8R/",
    title: "Success Stories",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://youtu.be/nmwe8RmXXcY",
    title: "Sales Training",
    thumbnail: "",
    platform: "youtube"
  }
];

export const MotivationalVideoCarousel = () => {
  const [randomVideo, setRandomVideo] = useState<Video | null>(null);

  useEffect(() => {
    // Pick a random video on mount
    const randomIndex = Math.floor(Math.random() * videos.length);
    setRandomVideo(videos[randomIndex]);
  }, []);

  if (!randomVideo) return null;

  return (
    <a
      href={randomVideo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block animate-fade-in"
    >
      <Card className="overflow-hidden hover:border-primary transition-all hover:shadow-lg">
        <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-primary/90 rounded-full p-6 group-hover:scale-110 transition-transform">
              <Play className="w-12 h-12 text-primary-foreground fill-current" />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <span className="text-white font-semibold">{randomVideo.title}</span>
          </div>
        </div>
      </Card>
    </a>
  );
};
