import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Recruit } from "@/hooks/useGroupRecruits";
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

export const EditRecruitDrawer = ({ 
  open, 
  onOpenChange, 
  recruit,
  onSuccess 
}: EditRecruitDrawerProps) => {
  const queryClient = useQueryClient();
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('');
  const [location, setLocation] = useState('');
  const [recruitmentSource, setRecruitmentSource] = useState('');
  const [recruiter, setRecruiter] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedMgmtId, setSelectedMgmtId] = useState('');
  
  // Combobox states
  const [locationOpen, setLocationOpen] = useState(false);
  const [recruiterOpen, setRecruiterOpen] = useState(false);

  // Fetch Notion property options
  const { data: notionOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['notion-property-options-extended'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-notion-property-options');
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

  // Initialize form when drawer opens
  useEffect(() => {
    if (open && recruit) {
      setName(recruit.name || '');
      setPhone(recruit.phone ? formatPhoneNumber(recruit.phone.replace(/^\+1/, '')) : '');
      setEmail(recruit.email || '');
      setStage(recruit.stage || '');
      // These fields aren't in the Recruit type, so leave empty for user to fill
      setLocation('');
      setRecruitmentSource('');
      setRecruiter(recruit.recruiterName || '');
      setSelectedTeamId(recruit.teamId || '');
      setSelectedMgmtId(recruit.mgmtGroupId || '');
    }
  }, [open, recruit]);

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
    
    updateMutation.mutate({
      name: name.trim(),
      phone: cleanPhone ? `+1${cleanPhone}` : '',
      email: email.trim(),
      stage,
      location,
      recruitmentSource,
      recruiter,
      teamsIds: selectedTeamId ? [selectedTeamId] : [],
      mgmtIds: selectedMgmtId ? [selectedMgmtId] : [],
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  // Sort options alphabetically
  const sortedLocationOptions = useMemo(() => 
    [...(notionOptions?.locationOptions || [])].sort(),
    [notionOptions?.locationOptions]
  );
  
  const sortedRecruiterOptions = useMemo(() => 
    [...(notionOptions?.recruiterOptions || [])].sort(),
    [notionOptions?.recruiterOptions]
  );

  if (optionsLoading) {
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
                      {sortedLocationOptions.map((loc) => (
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

          {/* Recruiter - Searchable Combobox */}
          <div>
            <Label>Recruiter</Label>
            <Popover open={recruiterOpen} onOpenChange={setRecruiterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={recruiterOpen}
                  className="w-full justify-between mt-1 font-normal"
                >
                  {recruiter || "Select recruiter..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search recruiters..." />
                  <CommandList>
                    <CommandEmpty>No recruiter found.</CommandEmpty>
                    <CommandGroup>
                      {sortedRecruiterOptions.map((r) => (
                        <CommandItem
                          key={r}
                          value={r}
                          onSelect={() => {
                            setRecruiter(r);
                            setRecruiterOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", recruiter === r ? "opacity-100" : "opacity-0")} />
                          {r}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Teams */}
          <div>
            <Label>Team</Label>
            <Select value={selectedTeamId || "__none__"} onValueChange={(v) => setSelectedTeamId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {notionOptions?.teamsOptions?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MGMT */}
          <div>
            <Label>MGMT Group</Label>
            <Select value={selectedMgmtId || "__none__"} onValueChange={(v) => setSelectedMgmtId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select MGMT group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {notionOptions?.mgmtOptions?.map((mgmt) => (
                  <SelectItem key={mgmt.id} value={mgmt.id}>{mgmt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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