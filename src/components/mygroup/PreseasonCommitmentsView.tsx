import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useBlitzes } from "@/hooks/useBlitzes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, ChevronUp, Calendar, MapPin, Plane, History, MessageSquare, Loader2 } from "lucide-react";
import { isBefore } from "date-fns";
import { parseDateAsLocal, formatBlitzDate } from "@/utils/blitzDateUtils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AddPhoneDrawer } from "@/components/ui/AddPhoneDrawer";

interface RookieInfo {
  userId: string;
  name: string;
  notionPageId: string;
  phone?: string;
  committedBlitzes: string[];
  isSelf?: boolean;
}

export const PreseasonCommitmentsView = () => {
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();
  const { allBlitzes: blitzes, loading: blitzesLoading } = useBlitzes();

  // Get current user's rep data
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id, year, phone, committed_blitzes')
        .eq('user_id', user.id)
        .single();
      
      return data;
    },
  });

  // Get rookies from accessible reps
  const { data: repsInfo, isLoading: repsLoading } = useQuery({
    queryKey: ['rookies-for-preseason', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return [];
      
      const { data } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id, year, phone, committed_blitzes')
        .in('user_id', teamAccess.accessibleUserIds)
        .eq('year', 'Rookie');
      
      return data || [];
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Build rookies list
  const rookies = useMemo(() => {
    const list: RookieInfo[] = [];

    // Add current user if they're a rookie
    if (currentUserRep?.year === 'Rookie' && currentUserRep?.user_id) {
      list.push({
        userId: currentUserRep.user_id,
        name: currentUserRep.name,
        notionPageId: currentUserRep.notion_page_id || '',
        phone: currentUserRep.phone || undefined,
        committedBlitzes: (currentUserRep.committed_blitzes as string[]) || [],
        isSelf: true,
      });
    }

    // Add other rookies
    repsInfo?.forEach(rep => {
      if (rep.user_id === currentUserRep?.user_id) return; // Skip self
      list.push({
        userId: rep.user_id,
        name: rep.name,
        notionPageId: rep.notion_page_id || '',
        phone: rep.phone || undefined,
        committedBlitzes: (rep.committed_blitzes as string[]) || [],
        isSelf: false,
      });
    });

    // Sort by number of commitments (fewest first = needs most attention)
    return list.sort((a, b) => a.committedBlitzes.length - b.committedBlitzes.length);
  }, [currentUserRep, repsInfo]);

  const isLoading = teamAccessLoading || blitzesLoading || repsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rookies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No rookies in your downline
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rookies.map(rookie => (
        <RookieBlitzCard 
          key={rookie.userId} 
          rookie={rookie} 
          blitzes={blitzes || []} 
        />
      ))}
    </div>
  );
};

interface RookieBlitzCardProps {
  rookie: RookieInfo;
  blitzes: Array<{ id: string; name: string; date: string; endDate: string | null; location?: string }>;
}

const RookieBlitzCard = ({ rookie, blitzes }: RookieBlitzCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const now = new Date();
  
  // Split blitzes into past and future
  const { pastBlitzes, futureBlitzes } = useMemo(() => {
    const past: typeof blitzes = [];
    const future: typeof blitzes = [];

    blitzes.forEach(blitz => {
      const endDate = parseDateAsLocal(blitz.endDate || blitz.date);
      if (endDate && isBefore(endDate, now)) {
        past.push(blitz);
      } else {
        future.push(blitz);
      }
    });

    // Sort past by most recent first, future by soonest first
    past.sort((a, b) => {
      const dateA = parseDateAsLocal(b.endDate || b.date);
      const dateB = parseDateAsLocal(a.endDate || a.date);
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });
    future.sort((a, b) => {
      const dateA = parseDateAsLocal(a.date);
      const dateB = parseDateAsLocal(b.date);
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });

    return { pastBlitzes: past, futureBlitzes: future };
  }, [blitzes, now]);

  // Get attended past blitzes
  const attendedPastBlitzes = pastBlitzes.filter(b => rookie.committedBlitzes.includes(b.id));
  const committedFutureCount = futureBlitzes.filter(b => rookie.committedBlitzes.includes(b.id)).length;

  const handleToggleCommitment = async (blitzId: string, isCurrentlyCommitted: boolean) => {
    setIsUpdating(blitzId);
    
    try {
      const newCommittedBlitzes = isCurrentlyCommitted
        ? rookie.committedBlitzes.filter(id => id !== blitzId)
        : [...rookie.committedBlitzes, blitzId];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          repNotionPageId: rookie.notionPageId,
          blitzPageIds: newCommittedBlitzes,
        },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['rookies-for-preseason'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });

      toast.success(isCurrentlyCommitted ? 'Removed from blitz' : 'Committed to blitz');
    } catch (error) {
      console.error('Failed to update blitz commitment:', error);
      toast.error('Failed to update commitment');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleText = () => {
    if (rookie.phone) {
      window.open(`sms:${rookie.phone}`, '_blank');
    }
    // Text button hidden when no phone number
  };

  const summaryText = `${committedFutureCount} upcoming · ${attendedPastBlitzes.length} attended`;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" />
              <span className="font-medium">{rookie.name}</span>
              {rookie.isSelf && (
                <Badge variant="secondary" className="text-xs">You</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {committedFutureCount === 0 && (
                <Badge variant="destructive" className="text-xs">No blitz</Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {!isOpen && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{summaryText}</p>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Past blitzes attended */}
            {attendedPastBlitzes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Past Blitzes Attended
                </div>
                <div className="space-y-1.5">
                  {attendedPastBlitzes.map(blitz => (
                    <div key={blitz.id} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span>{blitz.name}</span>
                      <span className="text-xs">
                        ({formatBlitzDate(blitz.date, 'MMM d')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Future blitzes */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Upcoming Blitzes
              </div>
              {futureBlitzes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No upcoming blitzes</p>
              ) : (
                <div className="space-y-2">
                  {futureBlitzes.map(blitz => {
                    const isCommitted = rookie.committedBlitzes.includes(blitz.id);
                    const isLoading = isUpdating === blitz.id;

                    return (
                      <div 
                        key={blitz.id} 
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isCommitted 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border bg-muted/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{blitz.name}</span>
                              {isCommitted && (
                                <Badge variant="default" className="text-xs">
                                  <Check className="w-3 h-3 mr-0.5" />
                                  Going
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3" />
                              {formatBlitzDate(blitz.date, 'MMM d')}
                              {blitz.endDate && ` - ${formatBlitzDate(blitz.endDate, 'MMM d')}`}
                            </div>
                            {blitz.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {blitz.location}
                              </div>
                            )}
                          </div>
                          {!rookie.isSelf && (
                            <Button
                              variant={isCommitted ? "destructive" : "default"}
                              size="sm"
                              disabled={isLoading}
                              onClick={() => handleToggleCommitment(blitz.id, isCommitted)}
                            >
                              {isLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isCommitted ? (
                                'Remove'
                              ) : (
                                'Add'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Text button for non-self */}
            {!rookie.isSelf && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleText}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Text {rookie.name.split(' ')[0]}
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
