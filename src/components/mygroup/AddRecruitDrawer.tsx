import { useState, useEffect, useMemo } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface SuggestionPrefill {
  suggestionId: string;
  name: string;
  phone: string;
  suggestedByNotionId?: string;
  suggestedByName: string;
  relationship?: string;
  notes?: string;
}

interface AddRecruitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestionPrefill?: SuggestionPrefill;
  onSuggestionApproved?: () => void;
  onRecruitCreated?: (notionPageId: string, name: string) => void;
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

// All 50 US States
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

// Format phone number as user types
const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Normalize string for comparison (lowercase, trim, remove extra spaces)
const normalizeString = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

// Location Combobox with search functionality
interface LocationComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  showCustomLocation: boolean;
  customLocation: string;
  onCustomLocationChange: (value: string) => void;
  onCancelCustom: () => void;
  hasError: boolean;
}

const LocationCombobox = ({
  value,
  onValueChange,
  options,
  showCustomLocation,
  customLocation,
  onCustomLocationChange,
  onCancelCustom,
  hasError,
}: LocationComboboxProps) => {
  const [open, setOpen] = useState(false);

  if (showCustomLocation) {
    return (
      <div>
        <Label className={hasError ? 'text-destructive' : ''}>
          Location (State) *
        </Label>
        <div className="mt-1 space-y-2">
          <Input
            value={customLocation}
            onChange={(e) => onCustomLocationChange(e.target.value)}
            placeholder="Enter new state name"
            className={hasError ? 'border-destructive ring-destructive' : ''}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelCustom}
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
          {hasError && (
            <p className="text-xs text-destructive">Location is required</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className={hasError ? 'text-destructive' : ''}>
        Location (State) *
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between mt-1 font-normal",
              !value && "text-muted-foreground",
              hasError && "border-destructive ring-destructive"
            )}
          >
            {value || "Search or select state..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Type to search states..." />
            <CommandList>
              <CommandEmpty>No state found.</CommandEmpty>
              <CommandGroup>
                {options.map((loc) => (
                  <CommandItem
                    key={loc}
                    value={loc}
                    onSelect={() => {
                      onValueChange(loc);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === loc ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {loc}
                  </CommandItem>
                ))}
                <CommandItem
                  value="__add_new__"
                  onSelect={() => {
                    onValueChange('__custom__');
                    setOpen(false);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add new state...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hasError && (
        <p className="text-xs text-destructive mt-1">Location is required</p>
      )}
    </div>
  );
};

export const AddRecruitDrawer = ({ open, onOpenChange, suggestionPrefill, onSuggestionApproved, onRecruitCreated }: AddRecruitDrawerProps) => {
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const queryClient = useQueryClient();
  const submitMutation = useSubmitSuggestion();
  const { data: mySuggestions } = useMySuggestions();
  const { data: teamAccess } = useTeamAccess();
  
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const isMgmtOrAbove = teamAccess?.accessLevel === 'mgmt_group_lead' || teamAccess?.accessLevel === 'area_director';

  // Fetch property options from Supabase
  const { data: notionOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['property-options'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-property-options');
      if (error) throw error;
      return data as {
        locationOptions: string[];
        recruitmentSourceOptions: string[];
      };
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  type CurrentRepIdentity = {
    authUserId: string;
    authEmail: string | null;
    name?: string | null;
    team_leader?: string | null;
    notion_page_id?: string | null;
    user_id?: string | null;
    email?: string | null;
  };

  // Get current user's rep data (robust: user_id first, then email fallback)
  const { data: currentRep } = useQuery<CurrentRepIdentity | null>({
    queryKey: ['current-rep-for-suggestion'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const base: CurrentRepIdentity = {
        authUserId: user.id,
        authEmail: user.email ?? null,
      };

      const { data: byUserId } = await supabase
        .from('reps')
        .select('name, team_leader, notion_page_id, user_id, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (byUserId) return { ...byUserId, ...base };

      if (user.email) {
        const { data: byEmail } = await supabase
          .from('reps')
          .select('name, team_leader, notion_page_id, user_id, email')
          .ilike('email', user.email)
          .maybeSingle();

        if (byEmail) return { ...byEmail, ...base };
      }

      return base;
    },
  });

  // Get team leader's notion page ID (for rep suggestions)
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-notion-id', currentRep?.team_leader],
    queryFn: async () => {
      if (!currentRep?.team_leader) return null;

      // Team leader field might be partial name (e.g., "Calvin") but db has full name with emojis
      // Use ILIKE for fuzzy matching
      const searchName = currentRep.team_leader.trim();
      
      const { data } = await supabase
        .from('reps')
        .select('notion_page_id, name')
        .ilike('name', `%${searchName}%`)
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!currentRep?.team_leader && !isLeader,
  });

  // Get all recruiters from accessible reps - filtered to active Signed+ stages only
  // Always include the current user + any prefilled/selected recruiter so the Select never shows a blank value.
  const allRecruiters = useMemo(() => {
    const accessible = teamAccess?.accessibleReps || [];
    if (accessible.length === 0) return [];

    const currentUserId = currentRep?.authUserId;

    const base = accessible.filter((r) => {
      if (!r.name) return false;
      if (!r.notionPageId) return false; // Need notionPageId to save

      // Always include current user regardless of stage
      if (currentUserId && r.userId === currentUserId) {
        return true;
      }

      const stageLower = (r.stage || '').toLowerCase();

      // Exclude exit/inactive stages first
      const excludePatterns = [
        'not interested',
        'left',
        'potential',
        'follow up',
        '100 list',
        '100_list',
        'reached out',
        'reached_out',
        'evaluating',
      ];
      if (excludePatterns.some((p) => stageLower.includes(p))) {
        return false;
      }

      // Include only: Signed, Shadow/Shadowed, Sold variants
      return stageLower.includes('signed') || stageLower.includes('shadow') || stageLower.includes('sold');
    });

    const byNotion = new Map<string, any>();
    base.forEach((r) => byNotion.set(r.notionPageId, r));

    const requiredNotionIds = [
      currentRep?.notion_page_id,
      suggestionPrefill?.suggestedByNotionId,
      selectedRecruiter,
    ].filter(Boolean) as string[];

    for (const notionId of requiredNotionIds) {
      if (byNotion.has(notionId)) continue;

      const match = accessible.find((r) => r.notionPageId === notionId);
      if (match?.name && match?.notionPageId) {
        byNotion.set(match.notionPageId, match);
        continue;
      }

      // Last resort: if we only know the current user's notion id + name, still make the Select show something.
      if (currentRep?.notion_page_id === notionId && currentRep?.name) {
        byNotion.set(notionId, {
          userId: currentRep.authUserId,
          name: currentRep.name,
          notionPageId: notionId,
        });
      }
    }

    return Array.from(byNotion.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [
    teamAccess?.accessibleReps,
    currentRep?.authUserId,
    currentRep?.notion_page_id,
    currentRep?.name,
    suggestionPrefill?.suggestedByNotionId,
    selectedRecruiter,
  ]);

  // Filter recruiters based on selected team (but always keep the currently selected recruiter visible)
  const filteredRecruiters = useMemo(() => {
    const base = !selectedTeam ? allRecruiters : allRecruiters.filter((r) => r.teamId === selectedTeam);

    if (!selectedRecruiter) return base;

    const selected = allRecruiters.find((r) => r.notionPageId === selectedRecruiter);
    if (!selected) return base;

    if (base.some((r) => r.notionPageId === selectedRecruiter)) return base;

    return [...base, selected];
  }, [allRecruiters, selectedTeam, selectedRecruiter]);

  // Filter teams based on selected recruiter's team
  const filteredTeams = useMemo(() => {
    if (!teamAccess?.teams) return [];
    if (!selectedRecruiter) return teamAccess.teams;
    
    const recruiterData = allRecruiters.find(r => r.notionPageId === selectedRecruiter);
    if (recruiterData?.teamId) {
      return teamAccess.teams.filter(t => t.id === recruiterData.teamId);
    }
    return teamAccess.teams;
  }, [teamAccess?.teams, selectedRecruiter, allRecruiters]);

  // Combined location options: all 50 states + any custom ones from existing data
  const locationOptions = useMemo(() => {
    const existingLocations = notionOptions?.locationOptions || [];
    const combined = new Set([...US_STATES, ...existingLocations]);
    return Array.from(combined).sort();
  }, [notionOptions?.locationOptions]);

  // Pre-fill form when opening with suggestion data
  useEffect(() => {
    if (open && suggestionPrefill) {
      setName(suggestionPrefill.name);
      setPhone(formatPhoneNumber(suggestionPrefill.phone.replace(/^\+1/, '')));
      setRelationship(suggestionPrefill.relationship || '');
      setNotes(suggestionPrefill.notes || '');
      // Set recruiter to the suggester's notion page ID if available
      if (suggestionPrefill.suggestedByNotionId) {
        setSelectedRecruiter(suggestionPrefill.suggestedByNotionId);
        // Also set the team based on the suggester's team
        const suggesterData = allRecruiters.find(r => r.notionPageId === suggestionPrefill.suggestedByNotionId);
        if (suggesterData?.teamId) {
          setSelectedTeam(suggesterData.teamId);
        }
      }
    } else if (open && isLeader && !suggestionPrefill && !selectedRecruiter) {
      // Default to current user when no prefill
      const currentUserId = currentRep?.authUserId;
      const currentUserData = currentUserId ? allRecruiters.find(r => r.userId === currentUserId) : null;

      const defaultRecruiterNotionId = currentUserData?.notionPageId || currentRep?.notion_page_id || '';

      if (defaultRecruiterNotionId) {
        setSelectedRecruiter(defaultRecruiterNotionId);
      }
      if (currentUserData?.teamId) {
        setSelectedTeam(currentUserData.teamId);
      }
    }
  }, [open, suggestionPrefill, isLeader, currentRep?.authUserId, currentRep?.notion_page_id, allRecruiters, selectedRecruiter]);

  // When team changes, clear recruiter if they're not on that team
  useEffect(() => {
    if (selectedTeam && selectedRecruiter) {
      const recruiterData = allRecruiters.find(r => r.notionPageId === selectedRecruiter);
      if (recruiterData && recruiterData.teamId !== selectedTeam) {
        // Reset to current user if they're on the new team, otherwise clear
        const currentUserId = currentRep?.authUserId;
        const currentUserData = currentUserId 
          ? allRecruiters.find(r => r.userId === currentUserId)
          : null;
        if (currentUserData?.teamId === selectedTeam && currentUserData?.notionPageId) {
          setSelectedRecruiter(currentUserData.notionPageId);
        } else {
          setSelectedRecruiter('');
        }
      }
    }
  }, [selectedTeam, allRecruiters, currentRep?.authUserId]);

  // When recruiter changes, auto-set their team
  const handleRecruiterChange = (recruiterId: string) => {
    setSelectedRecruiter(recruiterId);
    const recruiterData = allRecruiters.find(r => r.notionPageId === recruiterId);
    if (recruiterData?.teamId) {
      setSelectedTeam(recruiterData.teamId);
    }
  };

  // Create recruit mutation for leaders
  const createRecruitMutation = useMutation({
    mutationFn: async (recruitData: {
      name: string;
      phone: string;
      location: string;
      recruitmentSource: string;
      recruiterNotionId: string;
      recruiterName?: string;
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
      
      // If this was from a suggestion, notify parent to mark it approved
      if (suggestionPrefill && onSuggestionApproved) {
        onSuggestionApproved();
      }
      
      // Notify parent about the newly created recruit (for auto-opening detail drawer)
      if (onRecruitCreated && data.notionPageId) {
        onRecruitCreated(data.notionPageId, data.name);
      }
      
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
    setAttemptedSubmit(false);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleLocationChange = (value: string) => {
    if (value === '__custom__') {
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
    
    const normalizedNew = normalizeString(trimmed);
    
    // Check if it matches an existing location (case-insensitive)
    const existingMatch = locationOptions.find(
      loc => normalizeString(loc) === normalizedNew
    );
    
    if (existingMatch) {
      toast.error(`"${trimmed}" already exists as "${existingMatch}"`, {
        description: 'Please select it from the dropdown instead',
      });
      return false;
    }

    // Check for similar/typo (Levenshtein distance or simple check)
    const possibleTypo = locationOptions.find(loc => {
      const normalizedExisting = normalizeString(loc);
      // Check if starts with same letters or is very similar
      return normalizedExisting.startsWith(normalizedNew.slice(0, 3)) ||
             normalizedNew.startsWith(normalizedExisting.slice(0, 3));
    });

    if (possibleTypo) {
      const confirmed = window.confirm(
        `Did you mean "${possibleTypo}"? Click OK to use "${possibleTypo}" or Cancel to add "${trimmed}" as a new location.`
      );
      if (confirmed) {
        setLocation(possibleTypo);
        setShowCustomLocation(false);
        setCustomLocation('');
        return false;
      }
    }
    
    // Basic validation - should look like a location name (2+ chars, alpha only with spaces)
    if (!/^[A-Za-z\s]{2,}$/.test(trimmed)) {
      toast.error('Invalid location format', {
        description: 'Location should contain only letters and spaces',
      });
      return false;
    }
    
    return true;
  };

  // Check if leader form is valid
  const isLeaderFormValid = useMemo(() => {
    const finalLocation = showCustomLocation ? customLocation.trim() : location;
    return (
      name.trim() !== '' &&
      phone.trim() !== '' &&
      finalLocation !== '' &&
      recruitmentSource !== '' &&
      (selectedRecruiter || currentRep?.notion_page_id)
    );
  }, [name, phone, location, customLocation, showCustomLocation, recruitmentSource, selectedRecruiter, currentRep?.notion_page_id]);

  // Validation helpers
  const getFieldError = (field: 'name' | 'phone' | 'location' | 'recruitmentSource' | 'recruiter') => {
    if (!attemptedSubmit) return false;
    const finalLocation = showCustomLocation ? customLocation.trim() : location;
    switch (field) {
      case 'name': return !name.trim();
      case 'phone': return !phone.trim();
      case 'location': return !finalLocation;
      case 'recruitmentSource': return !recruitmentSource;
      case 'recruiter': return !(selectedRecruiter || currentRep?.notion_page_id);
      default: return false;
    }
  };

  const handleLeaderSubmit = async () => {
    setAttemptedSubmit(true);
    const finalLocation = showCustomLocation ? customLocation.trim() : location;
    const recruiterNotionId = selectedRecruiter || currentRep?.notion_page_id;

    // Validate all required fields
    const missingFields: string[] = [];
    if (!name.trim()) missingFields.push('Name');
    if (!phone.trim()) missingFields.push('Phone');
    if (!finalLocation) missingFields.push('Location');
    if (!recruitmentSource) missingFields.push('Recruitment source');
    if (!recruiterNotionId) missingFields.push('Recruiter');

    if (missingFields.length > 0) {
      toast.error('Missing required fields', {
        description: missingFields.join(', '),
      });
      return;
    }
    
    if (showCustomLocation && !validateCustomLocation(customLocation)) {
      return;
    }

    // Clean phone number for storage
    const cleanPhone = phone.replace(/\D/g, '');

    // Find recruiter name from allRecruiters
    const selectedRecruiterData = allRecruiters?.find(r => r.notionPageId === recruiterNotionId);
    const recruiterNameToSend = selectedRecruiterData?.name || suggestionPrefill?.suggestedByName;

    await createRecruitMutation.mutateAsync({
      name: name.trim(),
      phone: cleanPhone ? `+1${cleanPhone}` : '',
      location: finalLocation,
      recruitmentSource,
      recruiterNotionId: recruiterNotionId!,
      recruiterName: recruiterNameToSend,
      teamNotionId: selectedTeam || undefined,
      downlineNotionId: currentRep?.notion_page_id,
    });
  };

  const handleRepSubmit = async () => {
    setAttemptedSubmit(true);

    const missingFields: string[] = [];
    if (!name.trim()) missingFields.push('Name');
    if (!phone.trim()) missingFields.push('Phone');
    
    if (missingFields.length > 0) {
      toast.error('Missing required fields', {
        description: missingFields.join(', '),
      });
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
        return (
          <div className="flex flex-col items-end gap-0.5">
            <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> They're doing it!</Badge>
            <span className="text-[10px] text-muted-foreground">Help them prepare!</span>
          </div>
        );
      case 'rejected':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Not interested for now</Badge>;
      default:
        return null;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
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
              {optionsLoading && (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading options...
                </div>
              )}

              <div>
                <Label className={getFieldError('name') ? 'text-destructive' : ''}>
                  Name *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their full name"
                  className={`mt-1 ${getFieldError('name') ? 'border-destructive ring-destructive' : ''}`}
                />
                {getFieldError('name') && (
                  <p className="text-xs text-destructive mt-1">Name is required</p>
                )}
              </div>

              <div>
                <Label className={getFieldError('phone') ? 'text-destructive' : ''}>
                  Phone *
                </Label>
                <Input
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className={`mt-1 ${getFieldError('phone') ? 'border-destructive ring-destructive' : ''}`}
                />
                {getFieldError('phone') && (
                  <p className="text-xs text-destructive mt-1">Phone is required</p>
                )}
              </div>

              <LocationCombobox
                value={showCustomLocation ? customLocation : location}
                onValueChange={(val) => {
                  if (val === '__custom__') {
                    setShowCustomLocation(true);
                    setLocation('');
                  } else {
                    setShowCustomLocation(false);
                    setCustomLocation('');
                    setLocation(val);
                  }
                }}
                options={locationOptions}
                showCustomLocation={showCustomLocation}
                customLocation={customLocation}
                onCustomLocationChange={setCustomLocation}
                onCancelCustom={() => {
                  setShowCustomLocation(false);
                  setCustomLocation('');
                }}
                hasError={getFieldError('location')}
              />

              <div>
                <Label className={getFieldError('recruitmentSource') ? 'text-destructive' : ''}>
                  How did you recruit them? *
                </Label>
                <Select value={recruitmentSource} onValueChange={setRecruitmentSource}>
                  <SelectTrigger className={`mt-1 ${getFieldError('recruitmentSource') ? 'border-destructive ring-destructive' : ''}`}>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent modal={false}>
                    {notionOptions?.recruitmentSourceOptions.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError('recruitmentSource') && (
                  <p className="text-xs text-destructive mt-1">Recruitment source is required</p>
                )}
              </div>

              <div>
                <Label className={getFieldError('recruiter') ? 'text-destructive' : ''}>
                  Recruiter *
                </Label>
                <div className="flex gap-2 mt-1">
                  <Select value={selectedRecruiter} onValueChange={handleRecruiterChange}>
                    <SelectTrigger className={`flex-1 ${getFieldError('recruiter') ? 'border-destructive ring-destructive' : ''}`}>
                      <SelectValue placeholder="Select recruiter" />
                    </SelectTrigger>
                    <SelectContent modal={false}>
                      {filteredRecruiters?.map((recruiter) => (
                        <SelectItem key={recruiter.notionPageId} value={recruiter.notionPageId}>
                          <div className="flex flex-col items-start">
                            <span>{recruiter.name} {recruiter.notionPageId === currentRep?.notion_page_id ? '(You)' : ''}</span>
                            {recruiter.teamName && (
                              <span className="text-xs text-muted-foreground">{recruiter.teamName}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRecruiter && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="shrink-0"
                      onClick={() => setSelectedRecruiter('')}
                    >
                      <span className="sr-only">Clear</span>
                      ×
                    </Button>
                  )}
                </div>
                {getFieldError('recruiter') && (
                  <p className="text-xs text-destructive mt-1">Recruiter is required</p>
                )}
              </div>

              {/* Team selection for MGMT leads */}
              {isMgmtOrAbove && filteredTeams.length > 0 && (
                <div>
                  <Label>Team</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent modal={false}>
                        {filteredTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTeam && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        className="shrink-0"
                        onClick={() => setSelectedTeam('')}
                      >
                        <span className="sr-only">Clear</span>
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleLeaderSubmit}
                disabled={createRecruitMutation.isPending || !isLeaderFormValid}
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
                  <SelectContent modal={false}>
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
