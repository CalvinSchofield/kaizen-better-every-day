import { useEffect, useCallback } from "react";
import { 
  heroContent, 
  successStories, 
  culturePhotos, 
  alumniStories 
} from "@/data/aboutTeamData";

// All leaders used on the About Team page
const leaderPhotos = [
  "/images/about-team/calvin-schofield.jpeg",
  "/images/about-team/christian-fabian.png",
  "/images/about-team/adam-schofield.jpg",
  "/images/about-team/ansel-severson.png",
  "/images/about-team/ammon-allan.png",
  "/images/about-team/rj-ashton.jpg",
  "/images/about-team/quinn-gleed.png",
  "/images/about-team/misael-sanchez.png",
  "/images/about-team/micah-ao.png",
  "/images/about-team/jose-pineda.jpg",
  "/images/about-team/javier-estrada.jpg",
  "/images/about-team/jack-mair.png",
  "/images/about-team/ephraim-wilde.jpg",
  "/images/about-team/deandre-abraham.png",
  "/images/about-team/calder-severson.png",
];

// Preload a single image
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject();
    img.src = src;
  });
};

// Collect all images used on the About Team page
const getAllAboutTeamImages = (): string[] => {
  const images: string[] = [];
  
  // Hero background
  images.push(heroContent.backgroundImage);
  
  // Leader photos
  images.push(...leaderPhotos);
  
  // Success story photos (non-placeholder)
  successStories.forEach(story => {
    if (story.photo && !story.photo.includes('placeholder')) {
      images.push(story.photo);
    }
  });
  
  // Culture gallery photos
  culturePhotos.forEach(photo => {
    images.push(photo.src);
  });
  
  // Alumni photos and expandable images
  alumniStories.forEach(alumni => {
    if (alumni.photo) {
      images.push(alumni.photo);
    }
    if (alumni.expandableImage) {
      images.push(alumni.expandableImage);
    }
  });
  
  // Josh's text screenshot
  images.push("/images/about-team/josh-text.png");
  
  // Misael's house photo
  images.push("/images/about-team/misael-house.jpg");
  
  return [...new Set(images)]; // Remove duplicates
};

// Critical images that should load first (above the fold)
const getCriticalImages = (): string[] => [
  heroContent.backgroundImage,
  // First few leader photos visible in viewport
  ...leaderPhotos.slice(0, 6),
];

/**
 * Hook to prefetch About Team page images
 * Call this when you expect the user to navigate to About Team soon
 */
export const useAboutTeamPrefetch = (shouldPrefetch: boolean = false) => {
  const prefetchCritical = useCallback(async () => {
    const criticalImages = getCriticalImages();
    await Promise.allSettled(criticalImages.map(preloadImage));
  }, []);

  const prefetchAll = useCallback(async () => {
    const allImages = getAllAboutTeamImages();
    await Promise.allSettled(allImages.map(preloadImage));
  }, []);

  useEffect(() => {
    if (shouldPrefetch) {
      // First load critical images, then load the rest
      prefetchCritical().then(() => {
        prefetchAll();
      });
    }
  }, [shouldPrefetch, prefetchCritical, prefetchAll]);

  return { prefetchCritical, prefetchAll };
};

/**
 * Standalone function to prefetch About Team images
 * Can be called imperatively without a hook
 */
export const prefetchAboutTeamImages = async () => {
  const allImages = getAllAboutTeamImages();
  await Promise.allSettled(allImages.map(preloadImage));
};

/**
 * Prefetch only critical/above-fold images
 */
export const prefetchCriticalAboutTeamImages = async () => {
  const criticalImages = getCriticalImages();
  await Promise.allSettled(criticalImages.map(preloadImage));
};
