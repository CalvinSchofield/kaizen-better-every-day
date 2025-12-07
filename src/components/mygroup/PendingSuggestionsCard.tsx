import { useState } from "react";
import { RecruitSuggestion, useApproveSuggestion } from "@/hooks/useGroupRecruits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface PendingSuggestionsCardProps {
  suggestions: RecruitSuggestion[];
}

export const PendingSuggestionsCard = ({ suggestions }: PendingSuggestionsCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const approveMutation = useApproveSuggestion();

  // Get current user's notion page ID for recruiter assignment
  const { data: currentRep } = useQuery({
    queryKey: ['current-rep-notion-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('reps')
        .select('notion_page_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return data;
    },
  });

  const handleApprove = async (suggestion: RecruitSuggestion) => {
    try {
      await approveMutation.mutateAsync({
        suggestionId: suggestion.id,
        action: 'approve',
        recruiterNotionId: currentRep?.notion_page_id,
      });
      toast.success(`Approved ${suggestion.name}`, {
        description: 'Added to your 100 List',
      });
    } catch (error) {
      toast.error('Failed to approve suggestion');
    }
  };

  const handleReject = async (suggestion: RecruitSuggestion) => {
    try {
      await approveMutation.mutateAsync({
        suggestionId: suggestion.id,
        action: 'reject',
      });
      toast.success(`Rejected ${suggestion.name}`);
    } catch (error) {
      toast.error('Failed to reject suggestion');
    }
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader 
        className="pb-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Pending Suggestions
            <Badge variant="default" className="ml-1">
              {suggestions.length}
            </Badge>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-background rounded-lg p-3 border"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{suggestion.name}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.phone}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      From {suggestion.suggested_by_name}
                    </span>
                    {suggestion.relationship && (
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.relationship}
                      </Badge>
                    )}
                  </div>
                  {suggestion.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{suggestion.notes}"
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-3">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleReject(suggestion)}
                    disabled={approveMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleApprove(suggestion)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
};
