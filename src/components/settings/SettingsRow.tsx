import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  icon?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onClick?: () => void;
  toggle?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
  };
  chevron?: boolean;
  className?: string;
  destructive?: boolean;
  children?: React.ReactNode;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onClick,
  toggle,
  chevron,
  className,
  destructive,
  children,
}: SettingsRowProps) {
  const isClickable = !!onClick || !!chevron;
  const Wrapper = isClickable ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 min-h-[52px] py-3 text-left transition-colors",
        isClickable && "active:bg-accent/60",
        className
      )}
    >
      {icon && <span className="text-lg flex-shrink-0 w-6 text-center">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium leading-tight",
          destructive && "text-destructive"
        )}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
      {value && (
        <span className="text-sm text-muted-foreground flex-shrink-0">{value}</span>
      )}
      {toggle && (
        <Switch
          checked={toggle.checked}
          onCheckedChange={toggle.onCheckedChange}
          disabled={toggle.disabled}
          className="flex-shrink-0"
        />
      )}
      {(chevron || (isClickable && !toggle)) && !children && (
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
      )}
    </Wrapper>
  );
}
