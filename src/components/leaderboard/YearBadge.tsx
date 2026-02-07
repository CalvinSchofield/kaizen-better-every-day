import { cn } from "@/lib/utils";

interface YearBadgeProps {
  year: string | null | undefined;
  className?: string;
}

// Normalize year for display
const normalizeYear = (year: string | null | undefined): 'R' | 'S' | 'V' | null => {
  if (!year) return null;
  const lower = year.toLowerCase().trim();
  
  if (lower.includes('rookie') || lower === 'r' || lower === '1st' || lower === 'first') return 'R';
  if (lower.includes('sophomore') || lower.includes('soph') || lower === 's' || lower === '2nd' || lower === 'second') return 'S';
  if (lower.includes('vet') || lower === 'v' || lower === '3rd' || lower === 'third' || lower.includes('senior')) return 'V';
  
  return null;
};

export const YearBadge = ({ year, className }: YearBadgeProps) => {
  const normalized = normalizeYear(year);
  
  if (!normalized) return null;
  
  const colorClasses = {
    R: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
    S: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
    V: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  };
  
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded border",
        colorClasses[normalized],
        className
      )}
    >
      {normalized}
    </span>
  );
};
