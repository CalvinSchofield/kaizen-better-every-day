import { cn } from "@/lib/utils";
import { RARITY_COLORS } from "@/utils/badgeDefinitions";

interface BadgeIconProps {
  emoji: string;
  rarity?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-8 w-8 text-sm",
  lg: "h-12 w-12 text-xl",
};

export const BadgeIcon = ({ emoji, rarity = "common", size = "sm", className, onClick }: BadgeIconProps) => {
  const colors = RARITY_COLORS[rarity] || RARITY_COLORS.common;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-full flex items-center justify-center border bg-card shadow-sm",
        sizeClasses[size],
        colors.border,
        colors.glow && `shadow-md ${colors.glow}`,
        onClick && "cursor-pointer active:scale-90 transition-transform",
        className
      )}
    >
      {emoji}
    </div>
  );
};
