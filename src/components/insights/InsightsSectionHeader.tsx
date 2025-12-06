import { LucideIcon } from 'lucide-react';

interface InsightsSectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export const InsightsSectionHeader = ({ icon: Icon, title, description }: InsightsSectionHeaderProps) => {
  return (
    <div className="flex items-center gap-3 pt-4 pb-2">
      <div className="p-2 rounded-xl bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};
