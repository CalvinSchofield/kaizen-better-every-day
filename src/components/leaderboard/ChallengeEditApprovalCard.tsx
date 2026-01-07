import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, Loader2, Clock } from "lucide-react";
import { ChallengeEditProposal, ChallengeEditApproval, useRespondToEditProposal } from "@/hooks/useChallengeEdits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface ChallengeEditApprovalCardProps {
  proposal: ChallengeEditProposal & { approvals: ChallengeEditApproval[] };
  currentChallengeData: { stakes: string | null; end_date: string };
}

export const ChallengeEditApprovalCard = ({ 
  proposal, 
  currentChallengeData 
}: ChallengeEditApprovalCardProps) => {
  const respondMutation = useRespondToEditProposal();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: reps } = useQuery({
    queryKey: ['reps-for-approvals', proposal.id],
    queryFn: async () => {
      const userIds = proposal.approvals.map(a => a.user_id);
      const { data } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', userIds);
      return new Map(data?.map(r => [r.user_id, r]) || []);
    },
  });

  const myApproval = proposal.approvals.find(a => a.user_id === currentUser?.id);
  const needsMyResponse = myApproval && myApproval.approved === null;

  const handleRespond = async (approve: boolean) => {
    try {
      const result = await respondMutation.mutateAsync({
        proposalId: proposal.id,
        approve,
      });
      
      if (result.status === 'approved') {
        toast.success('Changes approved and applied!');
      } else if (result.status === 'rejected') {
        toast.info('Changes rejected');
      } else {
        toast.success(approve ? 'You approved the changes' : 'You rejected the changes');
      }
    } catch (error) {
      toast.error('Failed to respond');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">
          {proposal.proposer_name} proposed changes
        </span>
      </div>

      {/* Show proposed changes */}
      <div className="space-y-2 text-sm">
        {proposal.proposed_changes.stakes !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Stakes:</span>
            <span className="line-through text-muted-foreground">
              {currentChallengeData.stakes || 'None'}
            </span>
            <span className="text-foreground font-medium">
              → {proposal.proposed_changes.stakes || 'None'}
            </span>
          </div>
        )}
        {proposal.proposed_changes.end_date && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">End Date:</span>
            <span className="line-through text-muted-foreground">
              {format(parseISO(currentChallengeData.end_date), 'MMM d')}
            </span>
            <span className="text-foreground font-medium">
              → {format(parseISO(proposal.proposed_changes.end_date), 'MMM d')}
            </span>
          </div>
        )}
      </div>

      {/* Approval status */}
      <div className="flex flex-wrap gap-2">
        {proposal.approvals.map((approval) => {
          const rep = reps?.get(approval.user_id);
          return (
            <div 
              key={approval.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={rep?.profile_photo_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {rep?.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <span>{rep?.name || 'Unknown'}</span>
              {approval.approved === true && (
                <Check className="h-3 w-3 text-green-500" />
              )}
              {approval.approved === false && (
                <X className="h-3 w-3 text-red-500" />
              )}
              {approval.approved === null && (
                <Clock className="h-3 w-3 text-amber-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Response buttons */}
      {needsMyResponse && (
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleRespond(false)}
            disabled={respondMutation.isPending}
          >
            {respondMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                Reject
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => handleRespond(true)}
            disabled={respondMutation.isPending}
          >
            {respondMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </>
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
};
