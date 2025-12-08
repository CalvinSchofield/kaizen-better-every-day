import { Badge } from "@/components/ui/badge";
import { AttentionCategory } from "@/hooks/useNeedsAttention";
import { cn } from "@/lib/utils";

interface NeedsAttentionChipsProps {
  categories: AttentionCategory[];
  selectedCategory: string | null;
  onCategoryClick: (categoryId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'blitz-prep': 'bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20',
  'stale-contacts': 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20',
  'no-commitment': 'bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20',
  'hot-leads': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20',
  'training-progress': 'bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20', // Onboarding
  'readiness': 'bg-violet-500/10 text-violet-600 border-violet-500/30 hover:bg-violet-500/20',
};

export const NeedsAttentionChips = ({ 
  categories, 
  selectedCategory,
  onCategoryClick 
}: NeedsAttentionChipsProps) => {
  if (categories.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {categories.map((category) => (
        <Badge
          key={category.id}
          variant="outline"
          className={cn(
            "cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm transition-all flex-shrink-0",
            CATEGORY_COLORS[category.id] || 'bg-muted/50 text-muted-foreground',
            selectedCategory === category.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onClick={() => onCategoryClick(category.id)}
        >
          <span className="mr-1.5">{category.emoji}</span>
          <span className="font-medium">{category.count}</span>
          <span className="ml-1 opacity-80">{category.label}</span>
        </Badge>
      ))}
    </div>
  );
};
