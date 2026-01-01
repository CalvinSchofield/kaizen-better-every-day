import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Calendar, MapPin, Edit2, Trash2, Home, Wifi, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import BlitzFormDrawer from "@/components/admin/BlitzFormDrawer";
import DeleteBlitzDialog from "@/components/admin/DeleteBlitzDialog";
import { formatBlitzDateRange } from "@/utils/blitzDateUtils";

interface Accommodation {
  id: string;
  name: string;
  address: string | null;
  wifi_password: string | null;
  door_code: string | null;
  notes: string | null;
  sort_order: number;
}

interface Blitz {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string | null;
  created_by: string | null;
  accommodations: Accommodation[];
}

export default function AdminBlitzes() {
  const navigate = useNavigate();
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBlitz, setEditingBlitz] = useState<Blitz | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBlitz, setDeletingBlitz] = useState<Blitz | null>(null);

  const isLeader = teamAccess?.accessLevel === 'area_director' || 
                   teamAccess?.accessLevel === 'mgmt_group_lead' || 
                   teamAccess?.accessLevel === 'team_lead';

  useEffect(() => {
    if (!accessLoading && !isLeader) {
      navigate("/");
      toast({
        title: "Access Denied",
        description: "You must be a leader to access this page.",
        variant: "destructive",
      });
    }
  }, [accessLoading, isLeader, navigate]);

  const fetchBlitzes = async () => {
    setLoading(true);
    try {
      const { data: blitzesData, error: blitzesError } = await supabase
        .from("blitzes")
        .select("*")
        .order("date", { ascending: false });

      if (blitzesError) throw blitzesError;

      // Fetch accommodations for all blitzes
      const blitzIds = (blitzesData || []).map((b) => b.id);
      const { data: accommodationsData, error: accError } = await supabase
        .from("blitz_accommodations")
        .select("*")
        .in("blitz_id", blitzIds)
        .order("sort_order", { ascending: true });

      if (accError) throw accError;

      // Group accommodations by blitz
      const accByBlitz: Record<string, Accommodation[]> = {};
      (accommodationsData || []).forEach((acc) => {
        if (!accByBlitz[acc.blitz_id]) {
          accByBlitz[acc.blitz_id] = [];
        }
        accByBlitz[acc.blitz_id].push(acc);
      });

      const blitzesWithAcc: Blitz[] = (blitzesData || []).map((b) => ({
        ...b,
        accommodations: accByBlitz[b.id] || [],
      }));

      setBlitzes(blitzesWithAcc);
    } catch (error: any) {
      console.error("Error fetching blitzes:", error);
      toast({
        title: "Error",
        description: "Failed to load blitzes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLeader) {
      fetchBlitzes();
    }
  }, [isLeader]);

  const handleEdit = (blitz: Blitz) => {
    setEditingBlitz(blitz);
    setDrawerOpen(true);
  };

  const handleDelete = (blitz: Blitz) => {
    setDeletingBlitz(blitz);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBlitz) return;

    try {
      const { error } = await supabase
        .from("blitzes")
        .delete()
        .eq("id", deletingBlitz.id);

      if (error) throw error;

      toast({ title: "Blitz deleted successfully" });
      fetchBlitzes();
    } catch (error: any) {
      console.error("Error deleting blitz:", error);
      toast({
        title: "Error",
        description: "Failed to delete blitz",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingBlitz(null);
    }
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingBlitz(null);
  };

  const handleSaveSuccess = () => {
    handleDrawerClose();
    fetchBlitzes();
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!isLeader) {
    return null;
  }

  const now = new Date();
  const upcomingBlitzes = blitzes.filter((b) => new Date(b.end_date || b.date) >= now);
  const pastBlitzes = blitzes.filter((b) => new Date(b.end_date || b.date) < now);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b"
        style={{ paddingTop: 'var(--effective-safe-area-top)' }}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Manage Blitzes</h1>
          </div>
          <Button onClick={() => setDrawerOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Blitz
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Upcoming Blitzes */}
            <section>
              <h2 className="text-lg font-semibold mb-3 text-foreground">
                Upcoming Blitzes ({upcomingBlitzes.length})
              </h2>
              {upcomingBlitzes.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No upcoming blitzes. Create one to get started!
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcomingBlitzes.map((blitz) => (
                    <BlitzCard
                      key={blitz.id}
                      blitz={blitz}
                      onEdit={() => handleEdit(blitz)}
                      onDelete={() => handleDelete(blitz)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Past Blitzes */}
            {pastBlitzes.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                  Past Blitzes ({pastBlitzes.length})
                </h2>
                <div className="space-y-3 opacity-70">
                  {pastBlitzes.slice(0, 5).map((blitz) => (
                    <BlitzCard
                      key={blitz.id}
                      blitz={blitz}
                      onEdit={() => handleEdit(blitz)}
                      onDelete={() => handleDelete(blitz)}
                      isPast
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <BlitzFormDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        blitz={editingBlitz}
        onSuccess={handleSaveSuccess}
      />

      <DeleteBlitzDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        blitzName={deletingBlitz?.name || ""}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

interface BlitzCardProps {
  blitz: Blitz;
  onEdit: () => void;
  onDelete: () => void;
  isPast?: boolean;
}

function BlitzCard({ blitz, onEdit, onDelete, isPast }: BlitzCardProps) {
  const dateStr = formatBlitzDateRange(blitz.date, blitz.end_date);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{blitz.name}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{dateStr}</span>
            </div>
            {blitz.location && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{blitz.location}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Accommodations Preview */}
        {blitz.accommodations.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {blitz.accommodations.map((acc) => (
              <div key={acc.id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="shrink-0">
                  <Home className="h-3 w-3 mr-1" />
                  {acc.name}
                </Badge>
                {acc.wifi_password && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Wifi className="h-3 w-3" />
                    {acc.wifi_password}
                  </span>
                )}
                {acc.door_code && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    {acc.door_code}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
