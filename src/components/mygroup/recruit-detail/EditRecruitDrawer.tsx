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
  const [stage, setStage] = useState('');
  const [location, setLocation] = useState('');
  const [recruitmentSource, setRecruitmentSource] = useState('');
  const [recruiterUserId, setRecruiterUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedMgmtId, setSelectedMgmtId] = useState('');
  
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

  // Get accessible teams from teamAccess
  const accessibleTeams = useMemo(() => {
    if (!teamAccess) return [];
    return teamAccess.teams || [];
  }, [teamAccess]);

  // Get accessible MGMT groups from teamAccess
  const accessibleMgmtGroups = useMemo(() => {
    if (!teamAccess) return [];
    return teamAccess.mgmtGroups || [];
  }, [teamAccess]);

  // Get all recruiters with team info - filtered to Signed+ stages
  const allRecruiters = useMemo(() => {
    if (!teamAccess?.accessibleReps) return [];
    return teamAccess.accessibleReps.filter(rep => {
      if (!rep.name) return false;
      const stageLower = (rep.stage || '').toLowerCase();
      // Match stages: signed, shadow complete, sold, sold 5+, sold (5+)
      return (
        stageLower.includes('signed') ||
        stageLower.includes('shadow complete') ||
        stageLower.includes('shadow_complete') ||
        (stageLower.includes('sold') && !stageLower.includes('100'))
      );
    });
  }, [teamAccess?.accessibleReps]);

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
      setStage(recruitDetails.stage || '');
      setLocation(recruitDetails.location || '');
      setRecruitmentSource(recruitDetails.recruitment_source || '');
      setSelectedTeamId(recruitDetails.team_id || '');
      setSelectedMgmtId(recruitDetails.mgmt_group_id || '');
      
      // Set recruiter - don't filter by stage for initial load, just show what's in DB
      if (recruitDetails.recruiter_user_id) {
        setRecruiterUserId(recruitDetails.recruiter_user_id);
      }
      
      setFormInitialized(true);
    } else if (recruit) {
      // Fallback to the Recruit object if recruits table data isn't loaded yet
      setName(recruit.name || '');
      setPhone(recruit.phone ? formatPhoneNumber(recruit.phone.replace(/^\+1/, '')) : '');
      setEmail(recruit.email || '');
      setStage(recruit.stage || '');
      setLocation(recruit.location || '');
      setRecruitmentSource(recruit.recruitmentSource || '');
      setSelectedTeamId(recruit.teamId || '');
      setSelectedMgmtId(recruit.mgmtGroupId || '');
      
      // Set recruiter from recruit object
      if (recruit.recruiterUserId) {
        setRecruiterUserId(recruit.recruiterUserId);
      }
      
      setFormInitialized(true);
    }
  }, [open, recruit, recruitDetails, formInitialized]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('update-recruit-properties', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          recruitNotionPageId: recruit.notionPageId,
          recruiterOptions: notionOptions?.recruiterOptions || [],
          ...updates,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Recruit updated');
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-detail-live', recruit.notionPageId] });
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
      stage,
      location,
      recruitmentSource,
      recruiter: selectedRecruiter?.name || '',
      recruiterUserId,
      teamsIds: selectedTeamId ? [selectedTeamId] : [],
      mgmtIds: selectedMgmtId ? [selectedMgmtId] : [],
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
        <DrawerContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
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

          {/* Stage */}
          <div>
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
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

          {/* Teams - Only show accessible teams */}
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
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {accessibleTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeamId && (
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
          </div>

          {/* MGMT Group - Auto-selected based on team, but allow override for higher access levels */}
          <div>
            <Label>MGMT Group</Label>
            <Select 
              value={selectedMgmtId || "__none__"} 
              onValueChange={(v) => setSelectedMgmtId(v === "__none__" ? "" : v)}
              disabled={teamAccess?.accessLevel === 'team_lead'}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select MGMT group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {accessibleMgmtGroups.map((mgmt) => (
                  <SelectItem key={mgmt.id} value={mgmt.id}>{mgmt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamAccess?.accessLevel === 'team_lead' && (
              <p className="text-xs text-muted-foreground mt-1">Auto-selected based on team</p>
            )}
          </div>

          {/* Recruiter - Only show reps from the selected team */}
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
                            key={rep.userId || rep.notionPageId}
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