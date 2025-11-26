import { ReactNode } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

/**
 * ExternalLink component with smart routing:
 * - Notion links: Try to open in Notion app, fallback to browser
 * - Kaizen PWA: Open in same window to maintain PWA context
 * - Other external links: Open in new tab
 * - Shows external link icon by default
 */
export const ExternalLink = ({ 
  href, 
  children, 
  className,
  showIcon = true,
  iconClassName
}: ExternalLinkProps) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Check if it's a Kaizen PWA app
    if (href.includes('kaizen-better-every-day.lovable.app') || href.includes('kaizen-preseason-hub.lovable.app')) {
      e.preventDefault();
      // Open in same window to stay in PWA context
      window.location.href = href;
      return;
    }

    // Check if it's a Notion link and try to open in Notion app
    if (href.includes('notion.so') || href.includes('notion.site')) {
      e.preventDefault();
      // Extract page ID from URL and construct notion:// deep link
      const notionMatch = href.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
      if (notionMatch) {
        const pageId = notionMatch[1].replace(/-/g, '');
        const notionAppUrl = `notion://${pageId}`;
        
        // Try to open in Notion app
        window.location.href = notionAppUrl;
        
        // Fallback to web after short delay if app doesn't open
        setTimeout(() => {
          window.open(href, '_blank', 'noopener,noreferrer');
        }, 500);
        return;
      }
    }
    
    // For other links, allow default behavior (open in new tab)
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1.5 hover:underline", className)}
    >
      {children}
      {showIcon && (
        <ExternalLinkIcon className={cn("w-3.5 h-3.5 flex-shrink-0", iconClassName)} />
      )}
    </a>
  );
};
