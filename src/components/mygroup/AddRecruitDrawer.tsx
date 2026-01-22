import { useState, useEffect, useMemo, useRef } from "react";
import { useSubmitSuggestion, useMySuggestions } from "@/hooks/useGroupRecruits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { motion, AnimatePresence } from "framer-motion";
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
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Check, ChevronsUpDown, Plus, ChevronLeft, User, MapPin, Sparkles, Users, AlertTriangle, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { hapticLight, hapticMedium, hapticSuccess } from "@/utils/haptics";

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

// Popular recruitment sources as tappable cards
const RECRUITMENT_SOURCES = [
  { id: 'Referral', label: 'Referral', emoji: '👥' },
  { id: 'Social Media', label: 'Social Media', emoji: '📱' },
  { id: 'Church', label: 'Church', emoji: '⛪' },
  { id: 'School', label: 'School', emoji: '🎓' },
  { id: 'Work', label: 'Work', emoji: '💼' },
  { id: 'Family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
];

// Stages as segment buttons
const RECRUIT_STAGES = ['100 List', 'Reached Out', 'Evaluating', 'Signed'] as const;

// Format phone number as user types
const formatPhoneNumber = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Normalize string for comparison
const normalizeString = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

// Step indicator component
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
  <div className="flex items-center justify-center gap-1.5 py-2">
    {Array.from({ length: totalSteps }, (_, i) => (
      <div
        key={i}
        className={cn(
          "h-1.5 rounded-full transition-all duration-300",
          i === currentStep 
            ? "w-6 bg-primary" 
            : i < currentStep 
              ? "w-1.5 bg-primary/50" 
              : "w-1.5 bg-muted"
        )}
      />
    ))}
  </div>
);

// Location Combobox with search
interface LocationComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  hasError: boolean;
}

const LocationCombobox = ({ value, onValueChange, options, hasError }: LocationComboboxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-12 text-base",
            !value && "text-muted-foreground",
            hasError && "border-destructive ring-destructive"
          )}
        >
          {value || "Select state..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search states..." />
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
                    hapticLight();
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Animation variants
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
  }),
};

export const AddRecruitDrawer = ({ open, onOpenChange, suggestionPrefill, onSuggestionApproved, onRecruitCreated }: AddRecruitDrawerProps) => {
  // Wizard step state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [recruitmentSource, setRecruitmentSource] = useState('');
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('100 List');
  const [spouseName, setSpouseName] = useState('');
  const [cautionNotes, setCautionNotes] = useState('');
  
  // Rep suggestion state
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [showMySuggestions, setShowMySuggestions] = useState(false);

  const queryClient = useQueryClient();
  const submitMutation = useSubmitSuggestion();
  const { data: mySuggestions } = useMySuggestions();
  const { data: teamAccess } = useTeamAccess();
  
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const isMgmtOrAbove = teamAccess?.accessLevel === 'mgmt_group_lead' || teamAccess?.accessLevel === 'area_director';
  const totalSteps = isLeader ? 5 : 3; // Leaders have 5 steps, reps have 3

  // Fetch property options
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
    staleTime: 1000 * 60 * 60,
  });

  type CurrentRepIdentity = {
    authUserId: string;
    authEmail: string | null;
    id?: string | null;
    name?: string | null;
    team_leader?: string | null;
    user_id?: string | null;
    email?: string | null;
  };

  // Get current user's rep data
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
        .select('id, name, team_leader, user_id, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (byUserId) return { ...byUserId, ...base };

      if (user.email) {
        const { data: byEmail } = await supabase
          .from('reps')
          .select('id, name, team_leader, user_id, email')
          .ilike('email', user.email)
          .maybeSingle();

        if (byEmail) return { ...byEmail, ...base };
      }

      return base;
    },
  });

  // Get team leader's user_id (for rep suggestions)
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-id', currentRep?.team_leader],
    queryFn: async () => {
      if (!currentRep?.team_leader) return null;
      const searchName = currentRep.team_leader.trim();
      
      const { data } = await supabase
        .from('reps')
        .select('id, user_id, name')
        .ilike('name', `%${searchName}%`)
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!currentRep?.team_leader && !isLeader,
  });

  // Get all recruiters from accessible reps
  const allRecruiters = useMemo(() => {
    const accessible = teamAccess?.accessibleReps || [];
    if (accessible.length === 0) return [];

    const currentUserId = currentRep?.authUserId;

    const base = accessible.filter((r) => {
      if (!r.name || !r.id) return false;
      if (currentUserId && r.userId === currentUserId) return true;

      const stageLower = (r.stage || '').toLowerCase();
      const excludePatterns = [
        'not interested', 'left', 'potential', 'follow up',
        '100 list', '100_list', 'reached out', 'reached_out', 'evaluating',
      ];
      if (excludePatterns.some((p) => stageLower.includes(p))) return false;
      return stageLower.includes('signed') || stageLower.includes('shadow') || stageLower.includes('sold');
    });

    const byId = new Map<string, any>();
    base.forEach((r) => byId.set(r.id, r));

    const requiredIds = [currentRep?.id, suggestionPrefill?.suggestedByNotionId, selectedRecruiter].filter(Boolean) as string[];
    for (const repId of requiredIds) {
      if (byId.has(repId)) continue;
      const match = accessible.find((r) => r.id === repId);
      if (match?.name && match?.id) byId.set(match.id, match);
    }

    return Array.from(byId.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [teamAccess?.accessibleReps, currentRep?.authUserId, currentRep?.id, suggestionPrefill?.suggestedByNotionId, selectedRecruiter]);

  // Filter teams based on selected recruiter
  const filteredTeams = useMemo(() => {
    if (!teamAccess?.teams) return [];
    if (!selectedRecruiter) return teamAccess.teams;
    
    const recruiterData = allRecruiters.find(r => r.id === selectedRecruiter);
    if (recruiterData?.teamId) {
      return teamAccess.teams.filter(t => t.id === recruiterData.teamId);
    }
    return teamAccess.teams;
  }, [teamAccess?.teams, selectedRecruiter, allRecruiters]);

  // Combined location options
  const locationOptions = useMemo(() => {
    const existingLocations = notionOptions?.locationOptions || [];
    const combined = new Set([...US_STATES, ...existingLocations]);
    return Array.from(combined).sort();
  }, [notionOptions?.locationOptions]);

  // All recruitment source options
  const allSourceOptions = useMemo(() => {
    const apiSources = notionOptions?.recruitmentSourceOptions || [];
    const presetIds = RECRUITMENT_SOURCES.map(s => s.id);
    return [...RECRUITMENT_SOURCES, ...apiSources.filter(s => !presetIds.includes(s)).map(s => ({ id: s, label: s, emoji: '📋' }))];
  }, [notionOptions?.recruitmentSourceOptions]);

  // Track initialization
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      hasInitializedRef.current = false;
      setStep(0);
      setDirection(0);
    }
  }, [open]);

  // Pre-fill form when opening
  useEffect(() => {
    if (!open || hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const applyTeamFromRecruiter = async (recruiterId: string) => {
      if (!recruiterId) return;
      const recruiterData = allRecruiters.find((r) => r.id === recruiterId);
      if (recruiterData?.teamId) {
        setSelectedTeam(recruiterData.teamId);
        return;
      }
      const leadUserId = recruiterData?.userId || (recruiterId === currentRep?.id ? currentRep?.authUserId : null);
      if (!leadUserId) return;
      const { data } = await supabase.from('teams').select('id').eq('lead_user_id', leadUserId).maybeSingle();
      if (data?.id) setSelectedTeam(data.id);
    };

    if (suggestionPrefill) {
      setName(suggestionPrefill.name);
      setPhone(formatPhoneNumber(suggestionPrefill.phone.replace(/^\+1/, '')));
      setRelationship(suggestionPrefill.relationship || '');
      setNotes(suggestionPrefill.notes || '');
      if (suggestionPrefill.suggestedByNotionId) {
        setSelectedRecruiter(suggestionPrefill.suggestedByNotionId);
        void applyTeamFromRecruiter(suggestionPrefill.suggestedByNotionId);
      }
    } else if (isLeader) {
      const currentUserId = currentRep?.authUserId;
      const currentUserData = currentUserId ? allRecruiters.find((r) => r.userId === currentUserId) : null;
      const defaultRecruiterId = currentUserData?.id || currentRep?.id || '';
      if (defaultRecruiterId) {
        setSelectedRecruiter(defaultRecruiterId);
        void applyTeamFromRecruiter(defaultRecruiterId);
      }
    }
  }, [open, suggestionPrefill, isLeader, currentRep?.authUserId, currentRep?.id, allRecruiters]);

  // When recruiter changes, auto-set their team
  const handleRecruiterChange = (recruiterId: string) => {
    setSelectedRecruiter(recruiterId);
    hapticLight();

    void (async () => {
      const recruiterData = allRecruiters.find((r) => r.id === recruiterId);
      if (recruiterData?.teamId) {
        setSelectedTeam(recruiterData.teamId);
        return;
      }
      const leadUserId = recruiterData?.userId || (recruiterId === currentRep?.id ? currentRep?.authUserId : null);
      if (!leadUserId) return;
      const { data } = await supabase.from('teams').select('id').eq('lead_user_id', leadUserId).maybeSingle();
      if (data?.id) setSelectedTeam(data.id);
    })();
  };

  // Create recruit mutation
  const createRecruitMutation = useMutation({
    mutationFn: async (recruitData: {
      name: string;
      phone: string;
      email?: string;
      location: string;
      recruitmentSource: string;
      teamId?: string;
      mgmtGroupId?: string;
      stage?: string;
      spouseName?: string;
      cautionNotes?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-recruit', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: recruitData,
      });

      if (error) throw error;
      if (data?.duplicateEmail) throw new Error(data.error);
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      hapticSuccess();
      toast.success('Recruit added!', {
        description: `${data.name} has been added to your pipeline`,
      });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.refetchQueries({ queryKey: ['group-recruits'] });
      
      if (suggestionPrefill && onSuggestionApproved) {
        onSuggestionApproved();
      }
      
      if (onRecruitCreated && data.recruitId) {
        onRecruitCreated(data.recruitId, data.name);
      }
      
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Failed to create recruit:', error);
      toast.error('Failed to add recruit', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });

  const resetForm = () => {
    setStep(0);
    setDirection(0);
    setName('');
    setPhone('');
    setEmail('');
    setLocation('');
    setRecruitmentSource('');
    setSelectedRecruiter('');
    setSelectedTeam('');
    setSelectedStage('100 List');
    setSpouseName('');
    setCautionNotes('');
    setRelationship('');
    setNotes('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  // Navigation
  const goNext = () => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(s => s + 1);
      hapticLight();
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
      hapticLight();
    }
  };

  // Validation
  const isStep1Valid = name.trim() !== '' && phone.trim() !== '';
  const isStep2Valid = location !== '';
  const isStep3Valid = recruitmentSource !== '';
  const isStep4Valid = selectedRecruiter !== '' || !!currentRep?.id;
  
  const isValidEmail = (val: string) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isSignedStage = selectedStage === 'Signed';
  const emailValid = !isSignedStage || (email.trim() !== '' && isValidEmail(email));

  const handleLeaderSubmit = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (!emailValid) {
      toast.error('Valid email required for Signed stage');
      return;
    }

    await createRecruitMutation.mutateAsync({
      name: name.trim(),
      phone: cleanPhone ? `+1${cleanPhone}` : '',
      email: email.trim() || undefined,
      location,
      recruitmentSource,
      teamId: selectedTeam || undefined,
      stage: selectedStage,
      spouseName: spouseName.trim() || undefined,
      cautionNotes: cautionNotes.trim() || undefined,
    });
  };

  const handleRepSubmit = async () => {
    if (!teamLeaderData?.user_id) {
      toast.error('Could not find your team leader');
      return;
    }

    try {
      await submitMutation.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        relationship,
        notes,
        teamLeaderUserId: teamLeaderData.user_id,
        suggestedByName: currentRep?.name || 'Unknown',
      });

      hapticSuccess();
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

  // Get recruiter display name
  const recruiterName = useMemo(() => {
    const recruiter = allRecruiters.find(r => r.id === selectedRecruiter);
    return recruiter?.name || currentRep?.name || 'You';
  }, [selectedRecruiter, allRecruiters, currentRep?.name]);

  // Get team display name
  const teamName = useMemo(() => {
    const team = filteredTeams.find(t => t.id === selectedTeam);
    return team?.name || '';
  }, [selectedTeam, filteredTeams]);

  // Render step content for leaders
  const renderLeaderStep = () => {
    switch (step) {
      case 0: // Who are they?
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Who are they?</h3>
              <p className="text-sm text-muted-foreground">Let's start with the basics</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their full name"
                  className="h-12 text-base mt-1"
                  autoFocus
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className="h-12 text-base mt-1"
                />
              </div>

              <div>
                <Label>Email {isSignedStage && <span className="text-destructive">*</span>}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="their.email@example.com"
                  className="h-12 text-base mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Required when moving to Signed</p>
              </div>
            </div>

            <Button 
              className="w-full h-12"
              onClick={goNext}
              disabled={!isStep1Valid}
            >
              Continue
            </Button>
          </div>
        );

      case 1: // Where are they?
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Where are they from?</h3>
              <p className="text-sm text-muted-foreground">Select their home state</p>
            </div>

            <LocationCombobox
              value={location}
              onValueChange={setLocation}
              options={locationOptions}
              hasError={false}
            />

            <Button 
              className="w-full h-12"
              onClick={goNext}
              disabled={!isStep2Valid}
            >
              Continue
            </Button>
          </div>
        );

      case 2: // How did you find them?
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">How did you find them?</h3>
              <p className="text-sm text-muted-foreground">Select their recruitment source</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {allSourceOptions.slice(0, 8).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => {
                    setRecruitmentSource(source.id);
                    hapticLight();
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                    recruitmentSource === source.id 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl mb-1">{source.emoji}</span>
                  <span className="text-sm font-medium">{source.label}</span>
                </button>
              ))}
            </div>

            {/* Stage Selection */}
            <div className="space-y-2">
              <Label>Pipeline Stage</Label>
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {RECRUIT_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => {
                      setSelectedStage(stage);
                      hapticLight();
                    }}
                    className={cn(
                      "flex-1 py-2 px-2 text-xs font-medium rounded-md transition-all",
                      selectedStage === stage 
                        ? "bg-background shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              className="w-full h-12"
              onClick={goNext}
              disabled={!isStep3Valid}
            >
              Continue
            </Button>
          </div>
        );

      case 3: // Team & Notes
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Team Assignment</h3>
              <p className="text-sm text-muted-foreground">Assign to a recruiter and add notes</p>
            </div>

            <div className="space-y-4">
              {/* Recruiter */}
              <div>
                <Label>Recruiter</Label>
                <Select value={selectedRecruiter} onValueChange={handleRecruiterChange}>
                  <SelectTrigger className="h-12 mt-1">
                    <SelectValue placeholder="Select recruiter" />
                  </SelectTrigger>
                  <SelectContent modal={false}>
                    {allRecruiters.map((recruiter) => (
                      <SelectItem key={recruiter.id} value={recruiter.id}>
                        <div className="flex flex-col items-start">
                          <span>{recruiter.name} {recruiter.id === currentRep?.id ? '(You)' : ''}</span>
                          {recruiter.teamName && (
                            <span className="text-xs text-muted-foreground">{recruiter.teamName}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team selection for MGMT leads */}
              {isMgmtOrAbove && filteredTeams.length > 0 && (
                <div>
                  <Label>Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="h-12 mt-1">
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
                </div>
              )}

              {/* Spouse Name */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-pink-500" />
                  Spouse/Partner Name
                </Label>
                <Input
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                  placeholder="Optional"
                  className="h-12 mt-1"
                />
              </div>

              {/* Caution Notes */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Things to Look Out For
                </Label>
                <Textarea
                  value={cautionNotes}
                  onChange={(e) => setCautionNotes(e.target.value)}
                  placeholder="Any concerns or notes for the team..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            <Button 
              className="w-full h-12"
              onClick={goNext}
              disabled={!isStep4Valid}
            >
              Review
            </Button>
          </div>
        );

      case 4: // Review & Confirm
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Review & Add</h3>
              <p className="text-sm text-muted-foreground">Confirm the details below</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{phone}</span>
              </div>
              {email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">{recruitmentSource}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stage</span>
                <Badge variant="secondary">{selectedStage}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recruiter</span>
                <span className="font-medium">{recruiterName}</span>
              </div>
              {teamName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team</span>
                  <span className="font-medium">{teamName}</span>
                </div>
              )}
              {spouseName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spouse</span>
                  <span className="font-medium">{spouseName}</span>
                </div>
              )}
              {cautionNotes && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Watch Out</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{cautionNotes}</p>
                </div>
              )}
            </div>

            <Button 
              className="w-full h-12"
              onClick={handleLeaderSubmit}
              disabled={createRecruitMutation.isPending}
            >
              {createRecruitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                'Add to Pipeline'
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // Render step content for reps (simplified flow)
  const renderRepStep = () => {
    if (showMySuggestions) {
      return (
        <div className="space-y-3">
          {mySuggestions?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No suggestions yet
            </p>
          ) : (
            mySuggestions?.map((suggestion) => (
              <div key={suggestion.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{suggestion.name}</span>
                  {getStatusBadge(suggestion.status)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{suggestion.phone}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted {format(parseISO(suggestion.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            ))
          )}
        </div>
      );
    }

    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Who do you know?</h3>
              <p className="text-sm text-muted-foreground">Tell us about someone who'd be great</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their full name"
                  className="h-12 text-base mt-1"
                  autoFocus
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className="h-12 text-base mt-1"
                />
              </div>
            </div>

            <Button 
              className="w-full h-12"
              onClick={goNext}
              disabled={!isStep1Valid}
            >
              Continue
            </Button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">How do you know {name.split(' ')[0] || 'them'}?</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {RELATIONSHIPS.map((rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => {
                    setRelationship(rel);
                    hapticLight();
                  }}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    relationship === rel 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-sm font-medium">{rel}</span>
                </button>
              ))}
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any helpful context..."
                className="mt-1"
                rows={2}
              />
            </div>

            <Button 
              className="w-full h-12"
              onClick={goNext}
            >
              Review
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Review & Submit</h3>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{phone}</span>
              </div>
              {relationship && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Relationship</span>
                  <span className="font-medium">{relationship}</span>
                </div>
              )}
              {notes && (
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Notes</span>
                  <p className="text-sm mt-1">{notes}</p>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p>
                Your suggestion will be sent to <strong>{currentRep?.team_leader || 'your team leader'}</strong> for review.
              </p>
            </div>

            <Button 
              className="w-full h-12"
              onClick={handleRepSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Suggestion'
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="pb-0">
          <div className="flex items-center justify-between">
            {step > 0 && !showMySuggestions ? (
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="w-10" />
            )}
            <DrawerTitle className="text-center flex-1">
              {isLeader ? 'Add Recruit' : 'Suggest a Recruit'}
            </DrawerTitle>
            <div className="w-10" />
          </div>
          
          {!showMySuggestions && (
            <StepIndicator currentStep={step} totalSteps={totalSteps} />
          )}
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

          {optionsLoading && step === 2 && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading options...
            </div>
          )}

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={showMySuggestions ? 'suggestions' : step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {isLeader ? renderLeaderStep() : renderRepStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
