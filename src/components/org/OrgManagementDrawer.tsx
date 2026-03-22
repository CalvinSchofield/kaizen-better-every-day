import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Search, Building2, Users, Globe, UserPlus } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

// ==========================================
// CREATE DRAWER — for creating offices/regions
// ==========================================

interface CreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "office" | "region" | "team" | "mgmt_group";
  parentId?: string; // region_id when creating office, office_id for mgmt_group, mgmt_group_id for team
  parentName?: string;
}

export const CreateDrawer = ({ open, onOpenChange, type, parentId, parentName }: CreateDrawerProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [step, setStep] = useState<"name" | "lead">("name");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<{ userId: string | null; repId: string; name: string } | null>(null);
  const [reps, setReps] = useState<{ id: string; user_id: string | null; name: string }[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);

  const typeLabel = type === "office" ? "Office" : type === "region" ? "Region" : type === "mgmt_group" ? "MGMT Group" : "Team";
  const needsLeader = type === "team" || type === "mgmt_group";

  // Load all reps including ghost reps
  const loadReps = async () => {
    setLoadingReps(true);
    const { data } = await supabase.from("reps").select("id, user_id, name").order("name").limit(2000);
    setReps(data || []);
    setLoadingReps(false);
  };

  const filteredReps = useMemo(() => {
    if (!leadSearch.trim()) return reps.slice(0, 20);
    const q = leadSearch.toLowerCase();
    return reps.filter(r => getCleanName(r.name).toLowerCase().includes(q)).slice(0, 20);
  }, [reps, leadSearch]);

  const handleNameNext = () => {
    if (needsLeader) {
      setStep("lead");
      loadReps();
    } else {
      handleCreate();
    }
  };

  const handleCreate = async (leadUserId?: string | null, leadRepId?: string) => {
    if (!name.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (type === "office") {
        const { error } = await supabase.from("offices").insert({
          name: name.trim(),
          location: location.trim() || null,
          region_id: parentId || null,
          created_by: user?.id,
        });
        if (error) throw error;
      } else if (type === "region") {
        const { error } = await supabase.from("regions").insert({
          name: name.trim(),
          lead_user_id: user?.id,
        });
        if (error) throw error;
      } else if (type === "mgmt_group") {
        const { error } = await supabase.from("mgmt_groups").insert({
          name: name.trim(),
          lead_user_id: leadUserId || null,
          office_id: parentId || null,
        });
        if (error) throw error;
        if (!leadUserId && leadRepId) {
          toast.info("Leader will be auto-assigned when they create an account");
        }
      } else if (type === "team") {
        const { data: team, error: teamError } = await supabase.from("teams").insert({
          name: name.trim(),
          lead_user_id: leadUserId || null,
        }).select("id").single();
        if (teamError) throw teamError;
        if (parentId && team) {
          const { error: linkError } = await supabase.from("team_mgmt_groups").insert({
            team_id: team.id,
            mgmt_group_id: parentId,
          });
          if (linkError) throw linkError;
        }
        if (!leadUserId && leadRepId) {
          toast.info("Leader will be auto-assigned when they create an account");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      resetState();
      onOpenChange(false);
      toast.success(`${typeLabel} created`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetState = () => {
    setName("");
    setLocation("");
    setStep("name");
    setLeadSearch("");
    setSelectedLead(null);
    setReps([]);
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
              <Button
                onClick={handleNameNext}
                disabled={!name.trim()}
                className="w-full"
              >
                {needsLeader ? "Next — Choose Leader" : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create {typeLabel}
                  </>
                )}
              </Button>
            </>
          )}

          {step === "lead" && (
            <>
              <p className="text-sm text-muted-foreground">Who leads "{name.trim()}"?</p>
              <Button
                variant="outline"
                className="w-full text-muted-foreground"
                onClick={() => handleCreate(null)}
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
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {loadingReps ? (
                  <p className="text-sm text-center text-muted-foreground py-4">Loading...</p>
                ) : filteredReps.length > 0 ? (
                  filteredReps.map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => handleCreate(rep.user_id, rep.id)}
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
              <Button variant="outline" className="w-full" onClick={() => setStep("name")}>
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
