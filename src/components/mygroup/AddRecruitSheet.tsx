import { useState } from "react";
import { useSubmitSuggestion, useMySuggestions } from "@/hooks/useGroupRecruits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface AddRecruitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RELATIONSHIPS = [
  'Friend',
  'Roommate',
  'Coworker',
  'Family',
  'Classmate',
  'Acquaintance',
  'Other',
];

export const AddRecruitSheet = ({ open, onOpenChange }: AddRecruitSheetProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [showMySuggestions, setShowMySuggestions] = useState(false);

  const submitMutation = useSubmitSuggestion();
  const { data: mySuggestions } = useMySuggestions();

  // Get current user's rep data for team leader info
  const { data: currentRep } = useQuery({
    queryKey: ['current-rep-for-suggestion'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('reps')
        .select('name, team_leader, notion_page_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return data;
    },
  });

  // Get team leader's notion page ID
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-notion-id', currentRep?.team_leader],
    queryFn: async () => {
      if (!currentRep?.team_leader) return null;

      const { data } = await supabase
        .from('reps')
        .select('notion_page_id')
        .eq('name', currentRep.team_leader)
        .maybeSingle();

      return data;
    },
    enabled: !!currentRep?.team_leader,
  });

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    if (!teamLeaderData?.notion_page_id) {
      toast.error('Could not find your team leader');
      return;
    }

    try {
      await submitMutation.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        relationship,
        notes,
        teamLeaderNotionId: teamLeaderData.notion_page_id,
        suggestedByName: currentRep?.name || 'Unknown',
      });

      toast.success('Suggestion submitted!', {
        description: `${currentRep?.team_leader} will review ${name}`,
      });

      setName('');
      setPhone('');
      setRelationship('');
      setNotes('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to submit suggestion');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Suggest a Recruit</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Toggle between form and my suggestions */}
          <div className="flex gap-2">
            <Button
              variant={!showMySuggestions ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowMySuggestions(false)}
            >
              Add Someone
            </Button>
            <Button
              variant={showMySuggestions ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowMySuggestions(true)}
            >
              My Suggestions ({mySuggestions?.length || 0})
            </Button>
          </div>

          {showMySuggestions ? (
            <div className="space-y-3">
              {mySuggestions?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No suggestions yet
                </p>
              ) : (
                mySuggestions?.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-muted/50 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{suggestion.name}</span>
                      {getStatusBadge(suggestion.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {suggestion.phone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {format(parseISO(suggestion.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div>
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their full name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Phone *</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>How do you know them?</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((rel) => (
                      <SelectItem key={rel} value={rel}>
                        {rel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any helpful context..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p>
                  Your suggestion will be sent to <strong>{currentRep?.team_leader || 'your team leader'}</strong> for review.
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={submitMutation.isPending || !name || !phone}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Suggestion'}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
