import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MessageSquare, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentActivityCardProps {
  /** The userId of the rep being viewed */
  viewedUserId: string;
  /** Navigate to My Group / Recruit Detail */
  onViewAll?: () => void;
}

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  text: MessageSquare,
  in_person: Phone,
  note: FileText,
};

const formatRelativeTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  } catch {
    return "";
  }
};

export const RecentActivityCard = ({ viewedUserId, onViewAll }: RecentActivityCardProps) => {
  // Find the recruit record matching this user, then fetch activities
  const { data: activities, isLoading } = useQuery({
    queryKey: ['profile-recent-activities', viewedUserId],
    queryFn: async () => {
      // First, find the recruit ID for this user by matching reps -> recruits
      // The rep's id IS the recruit id (unified architecture)
      const { data: rep } = await supabase
        .from('reps')
        .select('id')
        .eq('user_id', viewedUserId)
        .maybeSingle();

      if (!rep) return [];

      const { data: acts } = await supabase
        .from('recruit_activities')
        .select('id, activity_type, notes, created_at')
        .eq('recruit_id', rep.id)
        .order('created_at', { ascending: false })
        .limit(3);

      return acts || [];
    },
    enabled: !!viewedUserId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !activities || activities.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Recent Activity
      </h3>

      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = ACTIVITY_ICONS[activity.activity_type] || FileText;
          const notes = activity.notes || 'No notes';
          const truncated = notes.length > 60 ? notes.slice(0, 60) + '…' : notes;

          return (
            <div
              key={activity.id}
              className="flex items-start gap-2.5 py-1.5"
            >
              <div className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-snug line-clamp-2">
                  {truncated}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(activity.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 mt-3 pt-2 border-t border-border text-xs font-medium text-primary w-full"
        >
          View All in My Group
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
