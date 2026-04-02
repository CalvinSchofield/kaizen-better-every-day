import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ label, children, className }: SettingsSectionProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pb-1">
          {label}
        </p>
      )}
      <div className="bg-card rounded-xl overflow-hidden divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}
