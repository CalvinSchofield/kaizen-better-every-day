import { useState, useEffect } from "react";
import { useSubmitSuggestion, useMySuggestions } from "@/hooks/useGroupRecruits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
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
import { Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface AddRecruitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Relationship options for rep suggestions
const RELATIONSHIPS = [
  'Friend',
  'Roommate',
  'Coworker',
  'Family',
  'Classmate',
  'Acquaintance',
  'Other',
];

// Recruitment source options for leaders
const RECRUITMENT_SOURCES = [
  'Referral',
  'Social Media',
  'Door Knock',
  'Event',
  'Cold Call',
  'Previous Contact',
  'Other',
];

// US States for location
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

// Format phone number as user types
const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export const AddRecruitDrawer = ({ open, onOpenChange }: AddRecruitDrawerProps) => {
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [recruitmentSource, setRecruitmentSource] = useState('');
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [showMySuggestions, setShowMySuggestions] = useState(false);

  const queryClient = useQueryClient();
  const submitMutation = useSubmitSuggestion();
  const { data: mySuggestions } = useMySuggestions();
  const { data: teamAccess } = useTeamAccess();
  
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const isMgmtOrAbove = teamAccess?.accessLevel === 'mgmt_group_lead' || teamAccess?.accessLevel === 'area_director';

  // Get current user's rep data
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

  // Get team leader's notion page ID (for rep suggestions)
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
    enabled: !!currentRep?.team_leader && !isLeader,
  });

  // Get available recruiters (team members) for leader selection
  const { data: availableRecruiters } = useQuery({
    queryKey: ['available-recruiters', teamAccess?.accessibleReps],
    queryFn: async () => {
      if (!teamAccess?.accessibleReps) return [];
      return teamAccess.accessibleReps.filter(r => r.notionPageId);
    },
    enabled: isLeader && !!teamAccess?.accessibleReps,
  });

  // Set default recruiter to current user when drawer opens
  useEffect(() => {
    if (open && isLeader && currentRep?.notion_page_id && !selectedRecruiter) {
      setSelectedRecruiter(currentRep.notion_page_id);
    }
  }, [open, isLeader, currentRep?.notion_page_id, selectedRecruiter]);

  // Create recruit mutation for leaders
  const createRecruitMutation = useMutation({
    mutationFn: async (recruitData: {
      name: string;
      phone: string;
      location: string;
      recruitmentSource: string;
      recruiterNotionId: string;
      teamNotionId?: string;
      mgmtNotionId?: string;
      downlineNotionId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-notion-recruit', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: recruitData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Recruit added!', {
        description: `${data.name} has been added to your pipeline`,
      });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Failed to create recruit:', error);
      toast.error('Failed to add recruit', {
        description: 'Please try again',
      });
    },
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setLocation('');
    setCustomLocation('');
    setShowCustomLocation(false);
    setRecruitmentSource('');
    setSelectedRecruiter('');
    setSelectedTeam('');
    setRelationship('');
    setNotes('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleLocationChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomLocation(true);
      setLocation('');
    } else {
      setShowCustomLocation(false);
      setLocation(value);
    }
  };

  const validateCustomLocation = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    
    // Check if it matches an existing state (case-insensitive)
    const existingMatch = US_STATES.find(
      state => state.toLowerCase() === trimmed.toLowerCase()
    );
    
    if (existingMatch) {
      toast.error(`"${trimmed}" already exists as "${existingMatch}"`, {
        description: 'Please select it from the dropdown instead',
      });
      return false;
    }
    
    // Basic validation - should look like a state name (2+ chars, alpha only)
    if (!/^[A-Za-z\s]{2,}$/.test(trimmed)) {
      toast.error('Invalid location format', {
        description: 'Location should contain only letters',
      });
      return false;
    }
    
    return true;
  };

  const handleLeaderSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    const finalLocation = showCustomLocation ? customLocation.trim() : location;
    
    if (showCustomLocation && !validateCustomLocation(customLocation)) {
      return;
    }

    const recruiterNotionId = selectedRecruiter || currentRep?.notion_page_id;
    if (!recruiterNotionId) {
      toast.error('Could not determine recruiter');
      return;
    }

    // Clean phone number for storage
    const cleanPhone = phone.replace(/\D/g, '');

    await createRecruitMutation.mutateAsync({
      name: name.trim(),
      phone: cleanPhone ? `+1${cleanPhone}` : '',
      location: finalLocation,
      recruitmentSource,
      recruiterNotionId,
      teamNotionId: selectedTeam || undefined,
      downlineNotionId: currentRep?.notion_page_id,
    });
  };

  const handleRepSubmit = async () => {
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

      resetForm();
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{isLeader ? 'Add Recruit' : 'Suggest a Recruit'}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          {/* Toggle for reps only */}
          {!isLeader && (
            <div className="flex gap-2 mb-4">
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
          )}

          {!isLeader && showMySuggestions ? (
            // Rep's suggestion history
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
          ) : isLeader ? (
            // Leader's direct add form
            <div className="space-y-4">
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
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Location (State)</Label>
                {showCustomLocation ? (
                  <div className="mt-1 space-y-2">
                    <Input
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Enter new state name"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCustomLocation(false);
                          setCustomLocation('');
                        }}
                      >
                        Cancel
                      </Button>
                      {customLocation && (
                        <p className="text-xs text-muted-foreground flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          New location will be created
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Select value={location} onValueChange={handleLocationChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">+ Add new state...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>How did you recruit them?</Label>
                <Select value={recruitmentSource} onValueChange={setRecruitmentSource}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECRUITMENT_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Recruiter</Label>
                <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select recruiter" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRecruiters?.map((recruiter) => (
                      <SelectItem key={recruiter.notionPageId} value={recruiter.notionPageId}>
                        {recruiter.name} {recruiter.notionPageId === currentRep?.notion_page_id ? '(You)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team selection for MGMT leads */}
              {isMgmtOrAbove && teamAccess?.teams && teamAccess.teams.length > 1 && (
                <div>
                  <Label>Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamAccess.teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleLeaderSubmit}
                disabled={createRecruitMutation.isPending || !name}
              >
                {createRecruitMutation.isPending ? 'Adding...' : 'Add Recruit'}
              </Button>
            </div>
          ) : (
            // Rep's suggestion form
            <div className="space-y-4">
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
                  onChange={handlePhoneChange}
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
                onClick={handleRepSubmit}
                disabled={submitMutation.isPending || !name || !phone}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Suggestion'}
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
