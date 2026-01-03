import { useState, useEffect, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BlurImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad'> {
  src: string;
  alt: string;
  containerClassName?: string;
  /** Show pulse animation while loading */
  showPulse?: boolean;
  /** Aspect ratio for the container (e.g., "aspect-square", "aspect-video") */
  aspectRatio?: string;
}

export const BlurImage = ({
  src,
  alt,
  className,
  containerClassName,
  showPulse = true,
  aspectRatio,
  loading = "lazy",
  ...props
}: BlurImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-muted", aspectRatio, containerClassName)}>
      {/* Blur placeholder */}
      {!isLoaded && !hasError && showPulse && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/20 animate-pulse" />
      )}
      
      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground/40 text-xs">Failed to load</span>
        </div>
      )}
      
      {/* Actual image */}
      {!hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          loading={loading}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          {...props}
        />
      )}
    </div>
  );
};
