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
    title: "As Advertised",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/777489575",
    title: "As Big As You Can Think It",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/742321231",
    title: "The Precious Things",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/805597083",
    title: "From the Ground Up",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://vimeo.com/683868546",
    title: "Tried & True",
    thumbnail: "",
    platform: "vimeo"
  },
  {
    url: "https://youtu.be/2jIia7aXins?si=ENG5VQRUlQlx17op",
    title: "Scott Galloway: \"Follow your passion is crap\"",
    thumbnail: "",
    platform: "youtube"
  },
  {
    url: "https://www.instagram.com/case.studies.podcast/reel/DA99WUTPxnh/",
    title: "Casey Baugh: \"Door to door is personal development\"",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://www.instagram.com/reel/DC2FOTxRO8R/?igsh=MW93b253c2ViY2d2aQ==",
    title: "Flight school made possible by Vivint",
    thumbnail: "",
    platform: "instagram"
  },
  {
    url: "https://youtube.com/shorts/gTd9VKc1XPE?si=c4sYH1Vmow27jCS_",
    title: "Matthew McConaughey: \"Give it your all\"",
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
      <Card className="overflow-hidden transition-all duration-150 active:scale-[0.98]">
        <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-primary/90 rounded-full p-6 transition-transform">
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
