import { Badge } from "@/components/ui/badge";
import { Users, Building, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScopeBadgeProps {
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'recruiter' | 'none';
  selectedCount: number;
  totalCount: number;
  scopeLabel: string;
  onClick?: () => void;
  className?: string;
}

export const ScopeBadge = ({ 
  accessLevel, 
  selectedCount, 
  totalCount, 
  scopeLabel,
  onClick,
  className 
}: ScopeBadgeProps) => {
  const getIcon = () => {
    switch (accessLevel) {
      case 'area_director':
        return <Building2 className="w-3.5 h-3.5" />;
      case 'mgmt_group_lead':
        return <Building className="w-3.5 h-3.5" />;
      case 'team_lead':
        return <Users className="w-3.5 h-3.5" />;
      default:
        return <User className="w-3.5 h-3.5" />;
    }
  };

  const isFiltered = selectedCount < totalCount;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "cursor-pointer hover:bg-accent transition-colors gap-1.5 py-1.5 px-3",
        isFiltered && "border-primary/50 bg-primary/5",
        className
      )}
      onClick={onClick}
    >
      {getIcon()}
      <span className="font-medium">{scopeLabel}</span>
      {isFiltered && (
        <span className="text-muted-foreground text-xs">
          ({selectedCount}/{totalCount})
        </span>
      )}
    </Badge>
  );
};
