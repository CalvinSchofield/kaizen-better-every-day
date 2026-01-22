import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Recruit } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EditRecruitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit;
  onSuccess?: () => void;
}

// Format phone number as user types
const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

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

export const EditRecruitDrawer = ({ 
  open, 
  onOpenChange, 
  recruit,
  onSuccess 
}: EditRecruitDrawerProps) => {
  const queryClient = useQueryClient();
  const { data: teamAccess } = useTeamAccess();
  
  // Track if form has been initialized for this drawer open session
  const [formInitialized, setFormInitialized] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [year, setYear] = useState('');
  const [stage, setStage] = useState('');
  const [location, setLocation] = useState('');
  const [recruitmentSource, setRecruitmentSource] = useState('');
  const [recruiterUserId, setRecruiterUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedMgmtId, setSelectedMgmtId] = useState('');
  const [significantOtherName, setSignificantOtherName] = useState('');
  const [watchOutNotes, setWatchOutNotes] = useState('');
  
  // Combobox states
  const [locationOpen, setLocationOpen] = useState(false);
  const [recruiterOpen, setRecruiterOpen] = useState(false);
  
  // Reset formInitialized when drawer closes
  useEffect(() => {
    if (!open) {
      setFormInitialized(false);
    }
  }, [open]);

  // Fetch the actual recruit data from the recruits table to get all fields
  const { data: recruitDetails, isLoading: recruitLoading } = useQuery({
    queryKey: ['recruit-details-for-edit', recruit.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruits')
        .select('*')
        .eq('id', recruit.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!recruit.id,
    staleTime: 0, // Always fetch fresh data when opening
  });

  // Fetch property options from Supabase
  const { data: notionOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['property-options-extended'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-property-options');
      if (error) throw error;
      return data as {
        locationOptions: string[];
        recruitmentSourceOptions: string[];
        stageOptions: string[];
        recruiterOptions: string[];
        teamsOptions: { id: string; name: string }[];
        mgmtOptions: { id: string; name: string }[];
      };
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch team_mgmt_groups mapping to auto-select MGMT group based on team
  const { data: teamMgmtMapping } = useQuery({
    queryKey: ['team-mgmt-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_mgmt_groups')
        .select('team_id, mgmt_group_id');
      if (error) throw error;
      return data as { team_id: string; mgmt_group_id: string }[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Get current user's rep data to include themselves as a recruiter option
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep-for-edit'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('reps')
        .select('id, user_id, name, phone, year, stage')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Get accessible teams from teamAccess - filter based on access level
  const accessibleTeams = useMemo(() => {
    if (!teamAccess) return [];
    const allTeams = teamAccess.teams || [];
    
    // Area directors see all teams
    if (teamAccess.accessLevel === 'area_director') {
      return allTeams;
    }
    
    // MGMT group leads see teams within their MGMT groups
    if (teamAccess.accessLevel === 'mgmt_group_lead') {
      const accessibleTeamIds = new Set(
        teamAccess.mgmtGroups?.flatMap(g => g.teamIds) || []
      );
      return allTeams.filter(t => accessibleTeamIds.has(t.id));
    }
    
    // Team leads see only their own team(s)
    if (teamAccess.accessLevel === 'team_lead' && currentUserRep?.user_id) {
      return allTeams.filter(t => t.groupLeadId === currentUserRep.user_id);
    }
    
    return allTeams;
  }, [teamAccess, currentUserRep?.user_id]);

  // Get all recruiters with team info - filtered to active Signed+ stages only
  // Include current user as a valid recruiter option
  const allRecruiters = useMemo(() => {
    const recruiters: Array<{
      id: string;
      userId: string | null;
      name: string;
      stage?: string | null;
      teamId?: string | null;
      teamName?: string | null;
    }> = [];
    
    // Add current user first if they're in an active stage
    if (currentUserRep) {
      const stageLower = (currentUserRep.stage || '').toLowerCase();
      const isActiveStage = 
        stageLower.includes('signed') ||
        stageLower.includes('shadow') ||
        stageLower.includes('sold');
      
      if (isActiveStage) {
        // Find their team info from accessible teams
        const userTeam = accessibleTeams.find(t => t.groupLeadId === currentUserRep.user_id);
        recruiters.push({
          id: currentUserRep.id,
          userId: currentUserRep.user_id,
          name: currentUserRep.name,
          stage: currentUserRep.stage,
          teamId: userTeam?.id || null,
          teamName: userTeam?.name || null,
        });
      }
    }
    
    // Add accessible reps from teamAccess
    if (teamAccess?.accessibleReps) {
      for (const rep of teamAccess.accessibleReps) {
        if (!rep.name || !rep.id) continue;
        // Skip if already added (current user)
        if (currentUserRep && rep.userId === currentUserRep.user_id) continue;
        
        const stageLower = (rep.stage || '').toLowerCase();
        
        // Exclude exit/inactive stages first
        const excludePatterns = ['not interested', 'left', 'potential', 'follow up', '100 list', '100_list', 'reached out', 'reached_out', 'evaluating'];
        if (excludePatterns.some(p => stageLower.includes(p))) continue;
        
        // Include only: Signed, Shadow/Shadowed, Sold variants
        if (stageLower.includes('signed') || stageLower.includes('shadow') || stageLower.includes('sold')) {
          recruiters.push({
            id: rep.id,
            userId: rep.userId,
            name: rep.name,
            stage: rep.stage,
            teamId: rep.teamId,
            teamName: rep.teamName,
          });
        }
      }
    }
    
    return recruiters;
  }, [teamAccess?.accessibleReps, currentUserRep, accessibleTeams]);

  // Filter recruiters based on selected team - only show reps that belong to the selected team
  const filteredRecruiters = useMemo(() => {
    if (!selectedTeamId) return allRecruiters;
    return allRecruiters.filter(rep => rep.teamId === selectedTeamId);
  }, [allRecruiters, selectedTeamId]);
  
  // Get team leader for fallback when current recruiter is invalid
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-for-fallback', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return null;
      const { data, error } = await supabase
        .from('teams')
        .select('lead_user_id')
        .eq('id', selectedTeamId)
        .maybeSingle();
      if (error || !data?.lead_user_id) return null;
      
      // Find the team lead in accessible reps
      return teamAccess?.accessibleReps?.find(r => r.userId === data.lead_user_id) || null;
    },
    enabled: !!selectedTeamId && !!teamAccess?.accessibleReps,
    staleTime: 1000 * 60 * 60,
  });

  // Combined location options: all 50 states + any custom ones from existing data
  const locationOptions = useMemo(() => {
    const existingLocations = notionOptions?.locationOptions || [];
    const combined = new Set([...US_STATES, ...existingLocations]);
    return Array.from(combined).sort();
  }, [notionOptions?.locationOptions]);

  // Auto-select MGMT group when team changes
  useEffect(() => {
    if (selectedTeamId && teamMgmtMapping) {
      const mapping = teamMgmtMapping.find(m => m.team_id === selectedTeamId);
      if (mapping) {
        setSelectedMgmtId(mapping.mgmt_group_id);
      }
    }
  }, [selectedTeamId, teamMgmtMapping]);

  // Initialize form when drawer opens - use data from recruits table
  // Only initialize once per drawer open to prevent re-renders from resetting form
  useEffect(() => {
    if (!open || formInitialized) return;
    
    if (recruitDetails) {
      setName(recruitDetails.name || '');
      setPhone(recruitDetails.phone ? formatPhoneNumber(recruitDetails.phone.replace(/^\+1/, '')) : '');
      setEmail(recruitDetails.email || '');
      setYear(recruitDetails.year || '');
      setStage(recruitDetails.stage || '');
      setLocation(recruitDetails.location || '');
      setRecruitmentSource(recruitDetails.recruitment_source || '');
      
      // For team, use existing or auto-select if user only has one accessible team
      const existingTeamId = recruitDetails.team_id || '';
      if (existingTeamId) {
        setSelectedTeamId(existingTeamId);
      } else if (accessibleTeams.length === 1) {
        setSelectedTeamId(accessibleTeams[0].id);
      } else {
        setSelectedTeamId('');
      }
      
      setSelectedMgmtId(recruitDetails.mgmt_group_id || '');
      
      // Set recruiter - don't filter by stage for initial load, just show what's in DB
      if (recruitDetails.recruiter_user_id) {
        setRecruiterUserId(recruitDetails.recruiter_user_id);
      }
      
      // Set new fields
      setSignificantOtherName(recruitDetails.significant_other_name || '');
      setWatchOutNotes(recruitDetails.watch_out_notes || '');
      
      setFormInitialized(true);
    } else if (recruit) {
      // Fallback to the Recruit object if recruits table data isn't loaded yet
      setName(recruit.name || '');
      setPhone(recruit.phone ? formatPhoneNumber(recruit.phone.replace(/^\+1/, '')) : '');
      setEmail(recruit.email || '');
      setYear((recruit as any).year || '');
      setStage(recruit.stage || '');
      setLocation(recruit.location || '');
      setRecruitmentSource(recruit.recruitmentSource || '');
      
      // For team, use existing or auto-select if user only has one accessible team
      const existingTeamId = recruit.teamId || '';
      if (existingTeamId) {
        setSelectedTeamId(existingTeamId);
      } else if (accessibleTeams.length === 1) {
        setSelectedTeamId(accessibleTeams[0].id);
      } else {
        setSelectedTeamId('');
      }
      
      setSelectedMgmtId(recruit.mgmtGroupId || '');
      
      // Set recruiter from recruit object
      if (recruit.recruiterUserId) {
        setRecruiterUserId(recruit.recruiterUserId);
      }
      
      // Set new fields - fallback to empty since Recruit type might not have these yet
      setSignificantOtherName('');
      setWatchOutNotes('');
      
      setFormInitialized(true);
    }
  }, [open, recruit, recruitDetails, formInitialized, accessibleTeams]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('update-recruit-properties', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          recruitId: recruit.id,
          ...updates,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Recruit updated');
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-detail-live', recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['recruit-details-extra', recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['recruit-details-for-edit', recruit.id] });
      // Invalidate assignable/mentionable users cache when recruiter changes
      queryClient.invalidateQueries({ queryKey: ['assignable-users', recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['mentionable-users', recruit.id] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Failed to update recruit:', error);
      toast.error('Failed to update recruit');
    },
  });

  const handleSave = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Find the recruiter name from the user ID
    const selectedRecruiter = allRecruiters.find(r => r.userId === recruiterUserId);
    
    updateMutation.mutate({
      name: name.trim(),
      phone: cleanPhone ? `+1${cleanPhone}` : '',
      email: email.trim(),
      year: year || null,
      stage,
      location,
      recruitmentSource,
      recruiterUserId,
      teamId: selectedTeamId || null,
      mgmtGroupId: selectedMgmtId || null,
      significantOtherName: significantOtherName.trim(),
      watchOutNotes: watchOutNotes.trim(),
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  // Get the selected recruiter's display (name + team)
  const selectedRecruiterDisplay = useMemo(() => {
    const recruiter = allRecruiters.find(r => r.userId === recruiterUserId);
    if (!recruiter) return '';
    return recruiter.teamName ? `${recruiter.name} (${recruiter.teamName})` : recruiter.name;
  }, [allRecruiters, recruiterUserId]);

  if (optionsLoading || recruitLoading) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Edit Recruit</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4">
            {/* Skeleton loading state */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-10 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          <DrawerFooter>
            <div className="h-10 bg-muted rounded animate-pulse" />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Edit Recruit</DrawerTitle>
        </DrawerHeader>
        
        <div className="overflow-y-auto px-4 pb-4 space-y-4">
          {/* Name */}
          <div>
            <Label>Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="mt-1"
            />
          </div>

          {/* Phone */}
          <div>
            <Label>Phone</Label>
            <Input 
              value={phone} 
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
          </div>

          {/* Email */}
          <div>
            <Label>Email</Label>
            <Input 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Year */}
          <div>
            <Label>Year</Label>
            <Select value={year || "__none__"} onValueChange={(v) => setYear(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not set</SelectItem>
                <SelectItem value="Rookie">Rookie (2025/2026)</SelectItem>
                <SelectItem value="Sophomore">Sophomore</SelectItem>
                <SelectItem value="Vet">Vet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stage */}
          <div>
            <Label>Stage</Label>
            <Select value={stage || "__none__"} onValueChange={(v) => setStage(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {notionOptions?.stageOptions?.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location - Searchable Combobox */}
          <div>
            <Label>Location</Label>
            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationOpen}
                  className="w-full justify-between mt-1 font-normal"
                >
                  {location || "Select location..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search locations..." />
                  <CommandList>
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      {locationOptions.map((loc) => (
                        <CommandItem
                          key={loc}
                          value={loc}
                          onSelect={() => {
                            setLocation(loc);
                            setLocationOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", location === loc ? "opacity-100" : "opacity-0")} />
                          {loc}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* How did you recruit them? */}
          <div>
            <Label>How did you recruit them?</Label>
            <Select value={recruitmentSource} onValueChange={setRecruitmentSource}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {notionOptions?.recruitmentSourceOptions?.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team - show first, scoped by access level */}
          <div>
            <Label>Team</Label>
            <div className="flex gap-2 mt-1">
              <Select 
                value={selectedTeamId || "__none__"} 
                onValueChange={(v) => {
                  setSelectedTeamId(v === "__none__" ? "" : v);
                  // Clear recruiter if team changes (they may not be in the new team)
                  if (v !== selectedTeamId) {
                    setRecruiterUserId('');
                  }
                }}
                disabled={accessibleTeams.length === 1} // Auto-select if only one team
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleTeams.length > 1 && <SelectItem value="__none__">None</SelectItem>}
                  {accessibleTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeamId && accessibleTeams.length > 1 && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setSelectedTeamId('');
                    setRecruiterUserId('');
                  }}
                >
                  <span className="sr-only">Clear</span>
                  ×
                </Button>
              )}
            </div>
            {accessibleTeams.length === 1 && (
              <p className="text-xs text-muted-foreground mt-1">Your team is auto-selected</p>
            )}
          </div>

          {/* Recruiter - Filtered by selected team */}
          <div>
            <Label>Recruiter</Label>
            <div className="flex gap-2 mt-1">
              <Popover open={recruiterOpen} onOpenChange={setRecruiterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={recruiterOpen}
                    className="flex-1 justify-between font-normal"
                  >
                    {selectedRecruiterDisplay || "Select recruiter..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search recruiters..." />
                    <CommandList>
                      <CommandEmpty>No recruiters found.</CommandEmpty>
                      <CommandGroup>
                      {filteredRecruiters.map((rep) => (
                          <CommandItem
                            key={rep.userId || rep.id}
                            value={`${rep.name} ${rep.teamName || ''}`}
                            onSelect={() => {
                              setRecruiterUserId(rep.userId || '');
                              // Auto-set team when recruiter is selected
                              if (rep.teamId) {
                                setSelectedTeamId(rep.teamId);
                              }
                              setRecruiterOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", recruiterUserId === rep.userId ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{rep.name}</span>
                              {rep.teamName && (
                                <span className="text-xs text-muted-foreground">{rep.teamName}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {recruiterUserId && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  className="shrink-0"
                  onClick={() => setRecruiterUserId('')}
                >
                  <span className="sr-only">Clear</span>
                  ×
                </Button>
              )}
            </div>
            {selectedTeamId && filteredRecruiters.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No accessible recruiters in this team</p>
            )}
          </div>

          {/* Significant Other Name */}
          <div>
            <Label>Significant Other</Label>
            <Input 
              value={significantOtherName} 
              onChange={(e) => setSignificantOtherName(e.target.value)}
              placeholder="Partner's name (optional)"
              className="mt-1"
            />
          </div>

          {/* Watch Out Notes */}
          <div>
            <Label className="flex items-center gap-1">
              <span>⚠️</span> Things to Watch Out For
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {[
                'Considering internship for the summer',
                'Looking at other D2D opportunities',
                'Married - haven\'t met with spouse yet',
                'Previous bad experience with D2D',
              ].map((objection) => {
                const isAdded = watchOutNotes.includes(objection);
                return (
                  <button
                    key={objection}
                    type="button"
                    onClick={() => {
                      if (isAdded) {
                        // Remove it
                        setWatchOutNotes(prev => 
                          prev.replace(objection, '').replace(/\n{2,}/g, '\n').trim()
                        );
                      } else {
                        // Add it
                        setWatchOutNotes(prev => 
                          prev ? `${prev.trim()}\n${objection}` : objection
                        );
                      }
                    }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95",
                      isAdded 
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300" 
                        : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {isAdded ? '✓ ' : '+ '}{objection}
                  </button>
                );
              })}
            </div>
            <textarea 
              value={watchOutNotes} 
              onChange={(e) => setWatchOutNotes(e.target.value)}
              placeholder="Frequent objections, concerns, red flags..."
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <DrawerFooter className="border-t pt-4">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateMutation.isPending || !name.trim()}
              className="flex-1"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};