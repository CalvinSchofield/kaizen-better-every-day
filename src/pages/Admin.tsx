import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Building2, Users, Shield, Plus, Trash2, Search } from "lucide-react";
import { hasMinAccess, getRoleLabel, ASSIGNABLE_ROLES, type AccessLevel } from "@/utils/roleHierarchy";

const Admin = () => {
  const navigate = useNavigate();
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const queryClient = useQueryClient();

  // Redirect if not corporate
  useEffect(() => {
    if (!accessLoading && teamAccess && !hasMinAccess(teamAccess.accessLevel, 'corporate')) {
      navigate('/');
      toast.error("You don't have access to admin settings");
    }
  }, [teamAccess, accessLoading, navigate]);

  if (accessLoading || !teamAccess) {
    return <Layout><div className="p-6 text-center text-muted-foreground">Loading...</div></Layout>;
  }

  if (!hasMinAccess(teamAccess.accessLevel, 'corporate')) {
    return null;
  }

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage offices, staff, and roles</p>
        </div>

        <Tabs defaultValue="offices">
          <TabsList className="w-full">
            <TabsTrigger value="offices" className="flex-1 gap-1.5">
              <Building2 className="h-4 w-4" />
              Offices
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-1 gap-1.5">
              <Shield className="h-4 w-4" />
              Roles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offices" className="mt-4">
            <OfficesTab />
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <RolesTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

// ============ OFFICES TAB ============

const OfficesTab = () => {
  const queryClient = useQueryClient();
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeLocation, setNewOfficeLocation] = useState("");

  // Fetch offices
  const { data: offices = [], isLoading } = useQuery({
    queryKey: ['admin-offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch office staff
  const { data: officeStaff = [] } = useQuery({
    queryKey: ['admin-office-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_staff')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch reps for staff name resolution
  const { data: allReps = [] } = useQuery({
    queryKey: ['admin-all-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select('id, user_id, name, email, phone');
      if (error) throw error;
      return data;
    },
  });

  const createOffice = useMutation({
    mutationFn: async () => {
      if (!newOfficeName.trim()) throw new Error('Name required');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('offices').insert({
        name: newOfficeName.trim(),
        location: newOfficeLocation.trim() || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] });
      setNewOfficeName("");
      setNewOfficeLocation("");
      toast.success("Office created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOffice = useMutation({
    mutationFn: async (officeId: string) => {
      const { error } = await supabase.from('offices').delete().eq('id', officeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] });
      toast.success("Office deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getRepName = (userId: string) => {
    const rep = allReps.find(r => r.user_id === userId);
    return rep?.name || userId.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      {/* Create office */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create Office</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Office name"
            value={newOfficeName}
            onChange={(e) => setNewOfficeName(e.target.value)}
          />
          <Input
            placeholder="Location (optional)"
            value={newOfficeLocation}
            onChange={(e) => setNewOfficeLocation(e.target.value)}
          />
          <Button
            onClick={() => createOffice.mutate()}
            disabled={!newOfficeName.trim() || createOffice.isPending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Office
          </Button>
        </CardContent>
      </Card>

      {/* Office list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center">Loading offices...</p>
      ) : offices.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center">No offices yet</p>
      ) : (
        offices.map((office) => {
          const staff = officeStaff.filter(s => s.office_id === office.id);
          return (
            <OfficeCard
              key={office.id}
              office={office}
              staff={staff}
              allReps={allReps}
              getRepName={getRepName}
              onDelete={() => deleteOffice.mutate(office.id)}
            />
          );
        })
      )}
    </div>
  );
};

interface OfficeCardProps {
  office: any;
  staff: any[];
  allReps: any[];
  getRepName: (userId: string) => string;
  onDelete: () => void;
}

const OfficeCard = ({ office, staff, allReps, getRepName, onDelete }: OfficeCardProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepUserId, setSelectedRepUserId] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState("area_director");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredReps = allReps.filter(r => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
  });

  const addStaff = useMutation({
    mutationFn: async () => {
      if (!selectedRepUserId) throw new Error('Select a rep');
      const { error } = await supabase.from('office_staff').insert({
        office_id: office.id,
        user_id: selectedRepUserId,
        role: staffRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-office-staff'] });
      setSelectedRepUserId(null);
      setSearchQuery("");
      setDrawerOpen(false);
      toast.success("Staff assigned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeStaff = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.from('office_staff').delete().eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-office-staff'] });
      toast.success("Staff removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{office.name}</CardTitle>
            {office.location && (
              <p className="text-xs text-muted-foreground">{office.location}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current staff */}
        {staff.length > 0 ? (
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getRepName(s.user_id)}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {s.role.replace('_', ' ')}
                  </Badge>
                </div>
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
          <p className="text-xs text-muted-foreground">No staff assigned</p>
        )}

        {/* Add staff drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Assign Staff
            </Button>
          </DrawerTrigger>
          <DrawerContent className="px-4 pb-8">
            <DrawerHeader className="px-0">
              <DrawerTitle>Assign Staff to {office.name}</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reps by name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedRepUserId(null);
                  }}
                  className="pl-10"
                />
              </div>

              {filteredReps.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredReps.slice(0, 20).map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => {
                        setSelectedRepUserId(rep.user_id);
                        setSearchQuery(rep.name);
                      }}
                      className={`w-full text-left p-2 rounded text-sm transition-colors ${
                        selectedRepUserId === rep.user_id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {rep.name}
                    </button>
                  ))}
                </div>
              )}

              <Select value={staffRole} onValueChange={setStaffRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area_director">Area Director</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>

              <Button
                className="w-full"
                disabled={!selectedRepUserId || addStaff.isPending}
                onClick={() => addStaff.mutate()}
              >
                Assign
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </CardContent>
    </Card>
  );
};

// ============ ROLES TAB ============

const RolesTab = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepUserId, setSelectedRepUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("assistant_manager");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch existing user roles
  const { data: userRoles = [] } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch reps
  const { data: allReps = [] } = useQuery({
    queryKey: ['admin-all-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select('id, user_id, name, email, phone');
      if (error) throw error;
      return data;
    },
  });

  const filteredReps = allReps.filter(r => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
  });

  const getRepName = (userId: string) => {
    const rep = allReps.find(r => r.user_id === userId);
    return rep?.name || userId.slice(0, 8);
  };

  const assignRole = useMutation({
    mutationFn: async () => {
      if (!selectedRepUserId) throw new Error('Select a rep');
      const { error } = await supabase.from('user_roles' as any).insert({
        user_id: selectedRepUserId,
        role: selectedRole,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      setSelectedRepUserId(null);
      setSearchQuery("");
      setDrawerOpen(false);
      toast.success("Role assigned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('user_roles' as any).delete().eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast.success("Role removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Assign role drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Assign Role
          </Button>
        </DrawerTrigger>
        <DrawerContent className="px-4 pb-8">
          <DrawerHeader className="px-0">
            <DrawerTitle>Assign Role</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reps by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedRepUserId(null);
                }}
                className="pl-10"
              />
            </div>

            {filteredReps.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                {filteredReps.slice(0, 20).map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setSelectedRepUserId(rep.user_id);
                      setSearchQuery(rep.name);
                    }}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      selectedRepUserId === rep.user_id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {rep.name}
                  </button>
                ))}
              </div>
            )}

            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="w-full"
              disabled={!selectedRepUserId || assignRole.isPending}
              onClick={() => assignRole.mutate()}
            >
              Assign Role
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Current roles list */}
      {userRoles.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No explicit roles assigned yet</p>
      ) : (
        <div className="space-y-2">
          {userRoles.map((ur) => (
            <div key={ur.id} className="flex items-center justify-between p-3 bg-card border rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{getRepName(ur.user_id)}</span>
                <Badge variant="secondary" className="text-xs">
                  {getRoleLabel(ur.role as AccessLevel)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => removeRole.mutate(ur.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Admin;
