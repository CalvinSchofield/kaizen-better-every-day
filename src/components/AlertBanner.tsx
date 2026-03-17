import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBannerProps {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  onClick?: () => void;
  variant?: 'default' | 'warning' | 'accent';
  className?: string;
}

export const AlertBanner = ({ icon, label, badge, onClick, variant = 'default', className }: AlertBannerProps) => {
  const variantStyles = {
    default: 'bg-card border-border hover:bg-accent/30',
    warning: 'bg-warning/10 border-warning/30 hover:bg-warning/15',
    accent: 'bg-primary/5 border-primary/20 hover:bg-primary/10',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all active:scale-[0.98]",
        variantStyles[variant],
        className
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left text-sm font-medium text-foreground truncate">{label}</span>
      {badge !== undefined && badge !== 0 && (
        <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
};
