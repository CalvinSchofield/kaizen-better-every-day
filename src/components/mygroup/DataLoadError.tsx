import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DataLoadErrorProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  lastUpdated?: Date | null;
}

export function DataLoadError({
  title = "Couldn't load data",
  message = "There was a problem loading your data. This might be temporary.",
  onRetry,
  isRetrying = false,
  lastUpdated,
}: DataLoadErrorProps) {
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">{message}</p>
        
        <Button 
          onClick={onRetry} 
          disabled={isRetrying}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Try Again'}
        </Button>
        
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-3">
            Last updated {getRelativeTime(lastUpdated)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
