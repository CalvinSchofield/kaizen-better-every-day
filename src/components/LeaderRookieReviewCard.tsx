import { useEffect, useState } from "react";
import { Users, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";

interface RookieNeedingReview {
  notionPageId: string;
  name: string;
  currentPhase: number;
  selfServiceComplete: boolean;
}

export const LeaderRookieReviewCard = () => {
  const navigate = useNavigate();
  const { data: teamAccess } = useTeamAccess();
  const [rookiesReady, setRookiesReady] = useState<RookieNeedingReview[]>([]);
  const [loading, setLoading] = useState(true);

  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  useEffect(() => {
    if (!isLeader) {
      setLoading(false);
      return;
    }

    const fetchRookiesNeedingReview = async () => {
      try {
        // Fetch team members from Notion
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) return;

        // Get current user's notion page id
        const { data: repData } = await supabase
          .from('reps')
          .select('notion_page_id')
          .eq('user_id', userData.user.id)
          .single();

        if (!repData?.notion_page_id) return;

        // Fetch team members
        const { data: teamData } = await supabase.functions.invoke('fetch-team-members', {
          body: { leaderNotionPageId: repData.notion_page_id },
        });

        if (!teamData?.teamMembers) return;

        // Get all rookie rep data to check self-service completion
        const { data: repsData } = await supabase
          .from('reps')
          .select('notion_page_id, name, year, watched_videos, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, committed_blitzes')
          .in('notion_page_id', teamData.teamMembers.map((m: any) => m.notionPageId));

        // Get goals data for setup_complete check
        const { data: goalsData } = await supabase
          .from('rep_goals')
          .select('user_id, setup_complete');

        const goalsMap = new Map((goalsData || []).map(g => [g.user_id, g.setup_complete]));

        // Get user_ids for reps
        const { data: userLinks } = await supabase
          .from('reps')
          .select('notion_page_id, user_id')
          .in('notion_page_id', teamData.teamMembers.map((m: any) => m.notionPageId));

        const userIdMap = new Map((userLinks || []).map(r => [r.notion_page_id, r.user_id]));

        const rookiesNeedingReview: RookieNeedingReview[] = [];

        (repsData || []).forEach((rep: any) => {
          // Only check rookies
          if (rep.year !== 'Rookie' && rep.year !== null) return;

          const watchedVideos = Array.isArray(rep.watched_videos) ? rep.watched_videos : [];
          const userId = userIdMap.get(rep.notion_page_id);
          const goalsSetupComplete = userId ? goalsMap.get(userId) === true : false;
          const hasCommittedBlitz = Array.isArray(rep.committed_blitzes) && rep.committed_blitzes.length > 0;

          // Check Phase 1 self-service completion
          const phase1VideosWatched = ["what-is-blitz", "how-pay-works"].every(id => watchedVideos.includes(id));
          const phase1SelfComplete = phase1VideosWatched && goalsSetupComplete && hasCommittedBlitz;
          
          if (phase1SelfComplete && !rep.ramp_phase_1_complete) {
            rookiesNeedingReview.push({
              notionPageId: rep.notion_page_id,
              name: rep.name,
              currentPhase: 1,
              selfServiceComplete: true,
            });
            return;
          }

          // Check Phase 2
          if (rep.ramp_phase_1_complete) {
            const phase2Complete = 
              watchedVideos.includes("phase2-product") &&
              watchedVideos.includes("phase2-quiz-passed") &&
              watchedVideos.includes("phase2-upgrades") &&
              watchedVideos.includes("phase2-takeover") &&
              watchedVideos.includes("phase2-pitch-submitted");
            
            if (phase2Complete && !rep.ramp_phase_2_complete) {
              rookiesNeedingReview.push({
                notionPageId: rep.notion_page_id,
                name: rep.name,
                currentPhase: 2,
                selfServiceComplete: true,
              });
              return;
            }
          }

          // Check Phase 3
          if (rep.ramp_phase_2_complete) {
            const phase3Complete = 
              watchedVideos.includes("phase3-ipad-ready") &&
              watchedVideos.includes("phase3-why-written") &&
              watchedVideos.includes("phase3-practice-scheduled");
            
            if (phase3Complete && !rep.ramp_phase_3_complete) {
              rookiesNeedingReview.push({
                notionPageId: rep.notion_page_id,
                name: rep.name,
                currentPhase: 3,
                selfServiceComplete: true,
              });
              return;
            }
          }

          // Check Phase 4
          if (rep.ramp_phase_3_complete) {
            const phase4Complete = 
              watchedVideos.includes("phase4-packing-done") &&
              watchedVideos.includes("phase4-essentials-checked") &&
              watchedVideos.includes("phase4-playbook-ready");
            
            if (phase4Complete && !rep.ramp_phase_4_complete) {
              rookiesNeedingReview.push({
                notionPageId: rep.notion_page_id,
                name: rep.name,
                currentPhase: 4,
                selfServiceComplete: true,
              });
            }
          }
        });

        setRookiesReady(rookiesNeedingReview);
      } catch (error) {
        console.error('Error fetching rookies needing review:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRookiesNeedingReview();
  }, [isLeader]);

  if (!isLeader || loading || rookiesReady.length === 0) {
    return null;
  }

  return (
    <Card 
      className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 cursor-pointer hover:shadow-md transition-all"
      onClick={() => navigate('/my-group')}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-foreground">Rookies Ready for Review</p>
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-0">
                {rookiesReady.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {rookiesReady.length === 1 
                ? `${rookiesReady[0].name} completed Phase ${rookiesReady[0].currentPhase}` 
                : `${rookiesReady.length} rookies waiting for phase verification`}
            </p>
          </div>
          
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
};
