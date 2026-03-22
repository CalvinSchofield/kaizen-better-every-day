import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Search, Building2, Users, Globe, UserPlus } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

// ==========================================
// CREATE DRAWER — for creating any org entity
// ==========================================

/**
 * Maps each entity type to its immediate parent:
 * - table: Supabase table holding parent entities
 * - label: Human-readable parent type label
 * - field: Column on the new entity that holds the parent reference
 *   ('__junction__' for team → team_mgmt_groups)
 */
const PARENT_RELATIONSHIP: Record<string, { table: string; label: string; field: string }> = {
  team:          { table: 'mgmt_groups',    label: 'MGMT Group',    field: '__junction__' },
  mgmt_group:    { table: 'sr_mgmt_groups', label: 'Sr MGMT Group', field: 'sr_mgmt_group_id' },
  sr_mgmt_group: { table: 'regions',         label: 'Region',        field: 'region_id' },
  office:        { table: 'regions',         label: 'Region',        field: 'region_id' },
  region:        { table: 'sr_regions',      label: 'Sr Region',     field: 'sr_region_id' },
  sr_region:     { table: 'partners',        label: 'Partnership',   field: 'partner_id' },
  partner:       { table: 'divisions',       label: 'Division',      field: 'division_id' },
};

interface CreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "office" | "region" | "team" | "mgmt_group" | "sr_mgmt_group" | "sr_region" | "partner" | "division";
  parentId?: string;
  parentName?: string;
  /** When parent comes from a context menu, specify the parent entity type
   *  (important for mgmt_group which can be under sr_mgmt_group OR office) */
  parentType?: string;
}

export const CreateDrawer = ({ open, onOpenChange, type, parentId, parentName, parentType: propParentType }: CreateDrawerProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [step, setStep] = useState<"name" | "lead" | "parent">("name");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadUserId, setSelectedLeadUserId] = useState<string | null>(null);
  const [selectedLeadName, setSelectedLeadName] = useState<string | null>(null);
  const [reps, setReps] = useState<{ id: string; user_id: string | null; name: string }[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);
  const [parentEntities, setParentEntities] = useState<{ id: string; name: string }[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>("__none__");
  const [autoFilledParent, setAutoFilledParent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeLabel = type === "office" ? "Office"
    : type === "region" ? "Region"
    : type === "mgmt_group" ? "MGMT Group"
    : type === "sr_mgmt_group" ? "Sr MGMT Group"
    : type === "sr_region" ? "Sr Region"
    : type === "partner" ? "Partnership"
    : type === "division" ? "Division"
    : "Team";

  const needsLeader = type !== "office";
  const parentRel = PARENT_RELATIONSHIP[type];
  // Show parent step only when no parentId was provided AND entity has a parent type
  const needsParentStep = !!parentRel && !parentId;

  const filteredReps = useMemo(() => {
    if (!leadSearch.trim()) return reps.slice(0, 20);
    const q = leadSearch.toLowerCase();
    return reps.filter(r => getCleanName(r.name).toLowerCase().includes(q)).slice(0, 20);
  }, [reps, leadSearch]);

  const loadReps = async () => {
    setLoadingReps(true);
    const { data } = await supabase.from("reps").select("id, user_id, name").order("name").limit(2000);
    setReps(data || []);
    setLoadingReps(false);
  };

  const loadParentEntities = async () => {
    if (!parentRel) return;
    let entities: { id: string; name: string }[] = [];
    
    const fetchEntities = async (table: string) => {
      const { data } = await supabase.from(table as any).select("id, name").order("name");
      return (data as any[] || []).map((d: any) => ({ id: d.id, name: d.name }));
    };

    entities = await fetchEntities(parentRel.table);
    setParentEntities(entities);
  };

  /** Try to auto-fill the parent based on the leader's current placement */
  const autoFillParent = async (leadUserId: string | null) => {
    if (!leadUserId || !parentRel) return;

    let foundParentId: string | null = null;

    try {
      switch (type) {
        case 'team': {
          // Check if leader currently leads a team → get that team's mgmt_group
          const { data: currentTeam } = await supabase
            .from('teams').select('id').eq('lead_user_id', leadUserId).maybeSingle();
          if (currentTeam) {
            const { data: tmg } = await supabase
              .from('team_mgmt_groups').select('mgmt_group_id').eq('team_id', currentTeam.id).maybeSingle();
            if (tmg?.mgmt_group_id) foundParentId = tmg.mgmt_group_id;
          }
          if (!foundParentId) {
            // Fallback: check recruit records for this user's mgmt group
            const { data: recruit } = await supabase
              .from('recruits').select('mgmt_group_id')
              .eq('recruiter_user_id', leadUserId)
              .not('mgmt_group_id', 'is', null)
              .limit(1).maybeSingle();
            if (recruit?.mgmt_group_id) foundParentId = recruit.mgmt_group_id;
          }
          break;
        }
        case 'mgmt_group': {
          const { data } = await supabase
            .from('mgmt_groups').select('sr_mgmt_group_id')
            .eq('lead_user_id', leadUserId).maybeSingle();
          if (data?.sr_mgmt_group_id) foundParentId = data.sr_mgmt_group_id;
          break;
        }
        case 'sr_mgmt_group': {
          const { data } = await supabase
            .from('sr_mgmt_groups').select('office_id')
            .eq('lead_user_id', leadUserId).maybeSingle();
          if (data?.office_id) foundParentId = data.office_id;
          break;
        }
        case 'region': {
          const { data } = await supabase
            .from('regions').select('sr_region_id')
            .eq('lead_user_id', leadUserId).maybeSingle();
          if (data?.sr_region_id) foundParentId = data.sr_region_id;
          break;
        }
        case 'sr_region': {
          const { data } = await supabase
            .from('sr_regions').select('partner_id')
            .eq('lead_user_id', leadUserId).maybeSingle();
          if (data?.partner_id) foundParentId = data.partner_id;
          break;
        }
        case 'partner': {
          const { data } = await supabase
            .from('partners').select('division_id')
            .eq('lead_user_id', leadUserId).maybeSingle();
          if (data?.division_id) foundParentId = data.division_id;
          break;
        }
      }
    } catch {
      // Silently fail auto-fill
    }

    if (foundParentId) {
      setSelectedParentId(foundParentId);
      setAutoFilledParent(true);
    }
  };

  const handleNameNext = () => {
    if (needsLeader) {
      setStep("lead");
      loadReps();
    } else if (needsParentStep) {
      // Office creation: no leader step but needs parent (region)
      loadParentEntities();
      setStep("parent");
    } else {
      handleCreate();
    }
  };

  const handleSelectLead = (userId: string | null, repName?: string, repId?: string) => {
    setSelectedLeadUserId(userId);
    setSelectedLeadName(repName || null);

    if (needsParentStep) {
      loadParentEntities();
      autoFillParent(userId);
      setStep("parent");
    } else {
      // parentId provided from context menu or no parent needed → submit
      handleCreate(userId, repId);
    }
  };

  const handleCreate = async (leadUserId?: string | null, leadRepId?: string) => {
    if (!name.trim()) return;
    setIsSubmitting(true);

    const finalLeadUserId = leadUserId !== undefined ? leadUserId : selectedLeadUserId;
    const finalParentId = selectedParentId !== "__none__" ? selectedParentId : parentId || null;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      switch (type) {
        case "office": {
          const { error } = await supabase.from("offices").insert({
            name: name.trim(),
            location: location.trim() || null,
            region_id: finalParentId,
            created_by: user?.id,
          });
          if (error) throw error;
          break;
        }
        case "region": {
          const { error } = await supabase.from("regions").insert({
            name: name.trim(),
            lead_user_id: finalLeadUserId || user?.id,
            sr_region_id: finalParentId,
          });
          if (error) throw error;
          break;
        }
        case "sr_mgmt_group": {
          const { error } = await supabase.from("sr_mgmt_groups").insert({
            name: name.trim(),
            lead_user_id: finalLeadUserId || null,
            office_id: finalParentId,
          });
          if (error) throw error;
          break;
        }
        case "sr_region": {
          const { error } = await supabase.from("sr_regions").insert({
            name: name.trim(),
            lead_user_id: finalLeadUserId || null,
            partner_id: finalParentId,
          });
          if (error) throw error;
          break;
        }
        case "partner": {
          const { error } = await supabase.from("partners").insert({
            name: name.trim(),
            lead_user_id: finalLeadUserId || null,
            division_id: finalParentId,
          });
          if (error) throw error;
          break;
        }
        case "division": {
          const { error } = await supabase.from("divisions").insert({
            name: name.trim(),
            lead_user_id: finalLeadUserId || null,
          });
          if (error) throw error;
          break;
        }
        case "mgmt_group": {
          // mgmt_group can be under sr_mgmt_group OR directly under office
          const mgData: Record<string, any> = {
            name: name.trim(),
            lead_user_id: finalLeadUserId || null,
          };
          if (finalParentId) {
            if (propParentType === 'office') {
              mgData.office_id = finalParentId;
            } else {
              // Default: parent is sr_mgmt_group (from top-level create or sr_mgmt_group context)
              mgData.sr_mgmt_group_id = finalParentId;
            }
          }
          const { error } = await supabase.from("mgmt_groups").insert(mgData as any);
          if (error) throw error;
          break;
        }
        case "team": {
          const { data: team, error: teamError } = await supabase.from("teams").insert({
            name: name.trim(),
            lead_user_id: finalLeadUserId || null,
          }).select("id").single();
          if (teamError) throw teamError;
          if (finalParentId && team) {
            const { error: linkError } = await supabase.from("team_mgmt_groups").insert({
              team_id: team.id,
              mgmt_group_id: finalParentId,
            });
            if (linkError) throw linkError;
          }
          break;
        }
      }

      if (!finalLeadUserId && leadRepId) {
        toast.info("Leader will be auto-assigned when they create an account");
      }

      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      resetState();
      onOpenChange(false);
      toast.success(`${typeLabel} created`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    setName("");
    setLocation("");
    setStep("name");
    setLeadSearch("");
    setSelectedLeadUserId(null);
    setSelectedLeadName(null);
    setReps([]);
    setParentEntities([]);
    setSelectedParentId("__none__");
    setAutoFilledParent(false);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            Create {typeLabel}
            {parentName && <span className="text-muted-foreground font-normal"> in {parentName}</span>}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-3 overflow-y-auto flex-1">
          {/* Step 1: Name */}
          {step === "name" && (
            <>
              <Input
                placeholder={`${typeLabel} name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {type === "office" && (
                <Input
                  placeholder="Location (optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              )}
              <Button onClick={handleNameNext} disabled={!name.trim()} className="w-full">
                {needsLeader ? "Next — Choose Leader" : needsParentStep ? `Next — Choose ${parentRel?.label || 'Parent'}` : (
                  <><Plus className="h-4 w-4 mr-2" />Create {typeLabel}</>
                )}
              </Button>
            </>
          )}

          {/* Step 2: Leader */}
          {step === "lead" && (
            <>
              <p className="text-sm text-muted-foreground">Who leads "{name.trim()}"?</p>
              <Button
                variant="outline"
                className="w-full text-muted-foreground"
                onClick={() => handleSelectLead(null)}
                disabled={isSubmitting}
              >
                Skip — Assign leader later
              </Button>
              <Separator />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-1.5 pr-1">
                  {loadingReps ? (
                    <p className="text-sm text-center text-muted-foreground py-4">Loading...</p>
                  ) : filteredReps.length > 0 ? (
                    filteredReps.map((rep) => (
                      <button
                        key={rep.id}
                        onClick={() => handleSelectLead(rep.user_id, getCleanName(rep.name), rep.id)}
                        disabled={isSubmitting}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors flex items-center justify-between"
                      >
                        <p className="text-sm font-medium">{getCleanName(rep.name)}</p>
                        {!rep.user_id && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                            No account yet
                          </Badge>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-center text-muted-foreground py-4">No results</p>
                  )}
                </div>
              </ScrollArea>
              <Button variant="outline" className="w-full" onClick={() => setStep("name")}>
                ← Back
              </Button>
            </>
          )}

          {/* Step 3: Parent assignment */}
          {step === "parent" && parentRel && (
            <>
              <p className="text-sm text-muted-foreground">
                {selectedLeadName
                  ? `Assign "${name.trim()}" (led by ${selectedLeadName}) to a ${parentRel.label}`
                  : `Assign "${name.trim()}" to a ${parentRel.label}`
                }
              </p>

              {autoFilledParent && selectedParentId !== "__none__" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Auto-selected based on {selectedLeadName || "leader"}'s current placement. You can change it below.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>{parentRel.label}</Label>
                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${parentRel.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No {parentRel.label.toLowerCase()} assigned</SelectItem>
                    {parentEntities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => handleCreate()}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Creating..." : `Create ${typeLabel}`}
              </Button>

              <Button variant="outline" className="w-full" onClick={() => setStep(needsLeader ? "lead" : "name")}>
                ← Back
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
// ==========================================
// CONFIGURE OFFICE DRAWER
// ==========================================

interface ConfigureOfficeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: string;
  officeName: string;
  officeLocation?: string | null;
  // Data from parent
  currentStaff: Array<{ id: string; user_id: string; role: string }>;
  currentMgmtGroups: Array<{ id: string; name: string; lead_user_id: string | null }>;
  allMgmtGroups: Array<{ id: string; name: string; office_id: string | null; lead_user_id: string | null }>;
  allReps: Array<{ user_id: string; name: string }>;
}

export const ConfigureOfficeDrawer = ({
  open, onOpenChange, officeId, officeName, officeLocation,
  currentStaff, currentMgmtGroups, allMgmtGroups, allReps,
}: ConfigureOfficeDrawerProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"overview" | "add-ad" | "add-group">("overview");

  const getRepName = (userId: string) => {
    const rep = allReps.find((r) => r.user_id === userId);
    return rep ? getCleanName(rep.name) : "Unknown";
  };

  const unassignedGroups = allMgmtGroups.filter(
    (mg) => !mg.office_id || mg.office_id === officeId
  );
  const availableGroups = unassignedGroups.filter(
    (mg) => !mg.office_id && mg.id !== officeId
  );

  const filteredReps = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allReps
      .filter((r) => getCleanName(r.name).toLowerCase().includes(q))
      .filter((r) => !currentStaff.some((s) => s.user_id === r.user_id))
      .slice(0, 15);
  }, [searchQuery, allReps, currentStaff]);

  const addStaff = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("office_staff").insert({
        office_id: officeId,
        user_id: userId,
        role: "area_director",
      });
      if (error) throw error;
      // Also add to area_directors table
      const { error: adError } = await supabase.from("area_directors").insert({
        user_id: userId,
      });
      // Ignore unique constraint errors
      if (adError && !adError.message.includes("duplicate")) throw adError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      setSearchQuery("");
      setActiveSection("overview");
      toast.success("Area Director assigned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeStaff = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.from("office_staff").delete().eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      toast.success("Staff removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignGroup = useMutation({
    mutationFn: async (mgmtGroupId: string) => {
      const { error } = await supabase
        .from("mgmt_groups")
        .update({ office_id: officeId })
        .eq("id", mgmtGroupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      setActiveSection("overview");
      toast.success("Group assigned to office");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unassignGroup = useMutation({
    mutationFn: async (mgmtGroupId: string) => {
      const { error } = await supabase
        .from("mgmt_groups")
        .update({ office_id: null })
        .eq("id", mgmtGroupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      toast.success("Group removed from office");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOffice = useMutation({
    mutationFn: async () => {
      // Unlink groups first
      const { error: unlinkErr } = await supabase
        .from("mgmt_groups")
        .update({ office_id: null })
        .eq("office_id", officeId);
      if (unlinkErr) throw unlinkErr;
      // Remove staff
      const { error: staffErr } = await supabase
        .from("office_staff")
        .delete()
        .eq("office_id", officeId);
      if (staffErr) throw staffErr;
      // Delete office
      const { error } = await supabase.from("offices").delete().eq("id", officeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      onOpenChange(false);
      toast.success("Office deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setActiveSection("overview"); }}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            {officeName}
            {officeLocation && <span className="text-sm font-normal text-muted-foreground">• {officeLocation}</span>}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeSection === "overview" && (
            <>
              {/* Area Directors */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Area Directors
                </p>
                {currentStaff.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentStaff.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium">{getRepName(s.user_id)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeStaff.mutate(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No area directors assigned</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveSection("add-ad")}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Area Director
                </Button>
              </div>

              <Separator />

              {/* MGMT Groups */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  MGMT Groups
                </p>
                {currentMgmtGroups.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentMgmtGroups.map((mg) => (
                      <div key={mg.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <div>
                          <span className="text-sm font-medium">{mg.name}</span>
                          {mg.lead_user_id && (
                            <span className="text-xs text-muted-foreground ml-1.5">
                              • {getRepName(mg.lead_user_id)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => unassignGroup.mutate(mg.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No groups assigned</p>
                )}
                {availableGroups.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setActiveSection("add-group")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add MGMT Group
                  </Button>
                )}
              </div>

              <Separator />

              {/* Delete */}
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Delete ${officeName}? Groups will be unlinked.`)) {
                    deleteOffice.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Office
              </Button>
            </>
          )}

          {activeSection === "add-ad" && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setActiveSection("overview")}>
                ← Back
              </Button>
              <p className="text-sm font-medium">Assign Area Director</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              {filteredReps.length > 0 && (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {filteredReps.map((rep) => (
                    <button
                      key={rep.user_id}
                      onClick={() => addStaff.mutate(rep.user_id)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <p className="text-sm font-medium">{getCleanName(rep.name)}</p>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && filteredReps.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No results</p>
              )}
            </div>
          )}

          {activeSection === "add-group" && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setActiveSection("overview")}>
                ← Back
              </Button>
              <p className="text-sm font-medium">Add MGMT Group to {officeName}</p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {availableGroups.map((mg) => (
                  <button
                    key={mg.id}
                    onClick={() => assignGroup.mutate(mg.id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-medium">{mg.name}</p>
                    {mg.lead_user_id && (
                      <p className="text-xs text-muted-foreground">Led by {getRepName(mg.lead_user_id)}</p>
                    )}
                  </button>
                ))}
              </div>
              {availableGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All groups are already assigned
                </p>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// ==========================================
// CONFIGURE REGION DRAWER
// ==========================================

interface ConfigureRegionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regionId: string;
  regionName: string;
  leadUserId?: string | null;
  currentOffices: Array<{ id: string; name: string; location?: string | null }>;
  allOffices: Array<{ id: string; name: string; location?: string | null; region_id?: string | null }>;
  allReps: Array<{ user_id: string; name: string }>;
}

export const ConfigureRegionDrawer = ({
  open, onOpenChange, regionId, regionName, leadUserId,
  currentOffices, allOffices, allReps,
}: ConfigureRegionDrawerProps) => {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<"overview" | "add-office">("overview");

  const getRepName = (userId: string) => {
    const rep = allReps.find((r) => r.user_id === userId);
    return rep ? getCleanName(rep.name) : "Unknown";
  };

  const unassignedOffices = allOffices.filter((o) => !o.region_id);

  const assignOffice = useMutation({
    mutationFn: async (officeId: string) => {
      const { error } = await supabase
        .from("offices")
        .update({ region_id: regionId })
        .eq("id", officeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      setActiveSection("overview");
      toast.success("Office assigned to region");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unassignOffice = useMutation({
    mutationFn: async (officeId: string) => {
      const { error } = await supabase
        .from("offices")
        .update({ region_id: null })
        .eq("id", officeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      toast.success("Office removed from region");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRegion = useMutation({
    mutationFn: async () => {
      // Unlink offices
      const { error: unlinkErr } = await supabase
        .from("offices")
        .update({ region_id: null })
        .eq("region_id", regionId);
      if (unlinkErr) throw unlinkErr;
      const { error } = await supabase.from("regions").delete().eq("id", regionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      onOpenChange(false);
      toast.success("Region deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setActiveSection("overview"); }}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {regionName}
            {leadUserId && (
              <span className="text-sm font-normal text-muted-foreground">
                • {getRepName(leadUserId)}
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeSection === "overview" && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Offices in this Region
                </p>
                {currentOffices.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentOffices.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <div>
                          <span className="text-sm font-medium">{o.name}</span>
                          {o.location && <span className="text-xs text-muted-foreground ml-1.5">• {o.location}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => unassignOffice.mutate(o.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No offices assigned</p>
                )}
                {unassignedOffices.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setActiveSection("add-office")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Office
                  </Button>
                )}
              </div>

              <Separator />

              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Delete ${regionName}? Offices will be unlinked.`)) {
                    deleteRegion.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Region
              </Button>
            </>
          )}

          {activeSection === "add-office" && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setActiveSection("overview")}>
                ← Back
              </Button>
              <p className="text-sm font-medium">Assign Office to {regionName}</p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {unassignedOffices.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => assignOffice.mutate(o.id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-medium">{o.name}</p>
                    {o.location && <p className="text-xs text-muted-foreground">{o.location}</p>}
                  </button>
                ))}
              </div>
              {unassignedOffices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All offices are already assigned
                </p>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
