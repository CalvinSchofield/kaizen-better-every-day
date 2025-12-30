import { useState } from "react";
import { RecruitSuggestion, useApproveSuggestion } from "@/hooks/useGroupRecruits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check, UserX, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { AddRecruitDrawer } from "./AddRecruitDrawer";

interface SuggestionPrefill {
  suggestionId: string;
  name: string;
  phone: string;
  suggestedByUserId?: string;
  suggestedByName: string;
  relationship?: string;
  notes?: string;
}

interface PendingSuggestionsCardProps {
  suggestions: RecruitSuggestion[];
}

export const PendingSuggestionsCard = ({ suggestions }: PendingSuggestionsCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionPrefill | null>(null);
  const approveMutation = useApproveSuggestion();

  // Get suggester's notion page IDs for recruiter assignment
  const { data: suggesterNotionIds } = useQuery({
    queryKey: ['suggester-notion-ids', suggestions.map(s => s.suggested_by_user_id)],
    queryFn: async () => {
      const userIds = [...new Set(suggestions.map(s => s.suggested_by_user_id))];
      if (userIds.length === 0) return {};

      const { data } = await supabase
        .from('reps')
        .select('user_id, id')
        .in('user_id', userIds);

      const mapping: Record<string, string> = {};
      data?.forEach(rep => {
        if (rep.id) {
          mapping[rep.user_id] = rep.id;
        }
      });
      return mapping;
    },
    enabled: suggestions.length > 0,
  });

  const handleApprove = (suggestion: RecruitSuggestion) => {
    // Open the AddRecruitDrawer with pre-filled data
    setSelectedSuggestion({
      suggestionId: suggestion.id,
      name: suggestion.name,
      phone: suggestion.phone,
      suggestedByUserId: suggesterNotionIds?.[suggestion.suggested_by_user_id],
      suggestedByName: suggestion.suggested_by_name,
      relationship: suggestion.relationship || undefined,
      notes: suggestion.notes || undefined,
    });
    setDrawerOpen(true);
  };

  const handleSuggestionApproved = async () => {
    if (!selectedSuggestion) return;
    
    try {
      await approveMutation.mutateAsync({
        suggestionId: selectedSuggestion.suggestionId,
        action: 'approve',
      });
    } catch (error) {
      console.error('Failed to mark suggestion as approved:', error);
    }
  };

  const handleNotProgressing = async (suggestion: RecruitSuggestion) => {
    try {
      await approveMutation.mutateAsync({
        suggestionId: suggestion.id,
        action: 'reject',
      });
      toast.success(`Marked as not progressing`, {
        description: `${suggestion.name} won't be added to your list`,
      });
    } catch (error) {
      toast.error('Failed to update suggestion');
    }
  };

  return (
    <>
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
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => handleNotProgressing(suggestion)}
                      disabled={approveMutation.isPending}
                      title="Not interested / not progressing"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleApprove(suggestion)}
                      disabled={approveMutation.isPending}
                      title="Add to my list"
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

      <AddRecruitDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedSuggestion(null);
        }}
        suggestionPrefill={selectedSuggestion || undefined}
        onSuggestionApproved={handleSuggestionApproved}
      />
    </>
  );
};
