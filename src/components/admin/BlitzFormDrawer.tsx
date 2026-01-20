import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Accommodation {
  id?: string;
  name: string;
  address: string;
  wifi_password: string;
  door_code: string;
  notes: string;
  sort_order: number;
}

interface Blitz {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string | null;
  accommodations: Accommodation[];
}

interface BlitzFormDrawerProps {
  open: boolean;
  onClose: () => void;
  blitz: Blitz | null;
  onSuccess: () => void;
}

export default function BlitzFormDrawer({ open, onClose, blitz, onSuccess }: BlitzFormDrawerProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);

  const isEditing = !!blitz;

  useEffect(() => {
    if (blitz) {
      setName(blitz.name);
      setDate(blitz.date);
      setEndDate(blitz.end_date || "");
      setLocation(blitz.location || "");
      setAccommodations(
        blitz.accommodations.map((a) => ({
          id: a.id,
          name: a.name,
          address: a.address || "",
          wifi_password: a.wifi_password || "",
          door_code: a.door_code || "",
          notes: a.notes || "",
          sort_order: a.sort_order,
        }))
      );
    } else {
      resetForm();
    }
  }, [blitz, open]);

  const resetForm = () => {
    setName("");
    setDate("");
    setEndDate("");
    setLocation("");
    setAccommodations([]);
  };

  const addAccommodation = () => {
    setAccommodations([
      ...accommodations,
      {
        name: accommodations.length === 0 ? "Main House" : `House ${accommodations.length + 1}`,
        address: "",
        wifi_password: "",
        door_code: "",
        notes: "",
        sort_order: accommodations.length,
      },
    ]);
  };

  const updateAccommodation = (index: number, field: keyof Accommodation, value: string) => {
    const updated = [...accommodations];
    updated[index] = { ...updated[index], [field]: value };
    setAccommodations(updated);
  };

  const removeAccommodation = (index: number) => {
    setAccommodations(accommodations.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "Start date is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (isEditing) {
        // Update blitz
        const { error: blitzError } = await supabase
          .from("blitzes")
          .update({
            name: name.trim(),
            date,
            end_date: endDate || null,
            location: location.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", blitz.id);

        if (blitzError) throw blitzError;

        // Delete existing accommodations and re-insert
        await supabase
          .from("blitz_accommodations")
          .delete()
          .eq("blitz_id", blitz.id);

        if (accommodations.length > 0) {
          const { error: accError } = await supabase
            .from("blitz_accommodations")
            .insert(
              accommodations.map((acc, idx) => ({
                blitz_id: blitz.id,
                name: acc.name.trim(),
                address: acc.address.trim() || null,
                wifi_password: acc.wifi_password.trim() || null,
                door_code: acc.door_code.trim() || null,
                notes: acc.notes.trim() || null,
                sort_order: idx,
              }))
            );

          if (accError) throw accError;
        }

        toast({ title: "Blitz updated successfully" });
      } else {
        // Create new blitz
        const { data: newBlitz, error: blitzError } = await supabase
          .from("blitzes")
          .insert({
            name: name.trim(),
            date,
            end_date: endDate || null,
            location: location.trim() || null,
            created_by: user?.id || null,
          })
          .select()
          .single();

        if (blitzError) throw blitzError;

        // Insert accommodations
        if (accommodations.length > 0 && newBlitz) {
          const { error: accError } = await supabase
            .from("blitz_accommodations")
            .insert(
              accommodations.map((acc, idx) => ({
                blitz_id: newBlitz.id,
                name: acc.name.trim(),
                address: acc.address.trim() || null,
                wifi_password: acc.wifi_password.trim() || null,
                door_code: acc.door_code.trim() || null,
                notes: acc.notes.trim() || null,
                sort_order: idx,
              }))
            );

          if (accError) throw accError;
        }

        toast({ title: "Blitz created successfully" });
      }

      // Invalidate all blitz-related caches to refresh data app-wide
      await queryClient.invalidateQueries({ queryKey: ['blitzes'] });
      await queryClient.invalidateQueries({ queryKey: ['blitz-attendance'] });
      
      onSuccess();
    } catch (error: any) {
      console.error("Error saving blitz:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save blitz",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{isEditing ? "Edit Blitz" : "Create New Blitz"}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto flex-1 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Blitz Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hemet Blitz"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Start Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={date}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Hemet, CA"
              />
            </div>
          </div>

          {/* Accommodations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Accommodations</Label>
              <Button variant="outline" size="sm" onClick={addAccommodation}>
                <Plus className="h-4 w-4 mr-1" />
                Add Airbnb
              </Button>
            </div>

            {accommodations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No accommodations added yet. Click "Add Airbnb" to add one.
              </p>
            ) : (
              <div className="space-y-4">
                {accommodations.map((acc, index) => (
                  <Card key={index} className="bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={acc.name}
                            onChange={(e) => updateAccommodation(index, "name", e.target.value)}
                            placeholder="House name"
                            className="w-40 h-8"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAccommodation(index)}
                          className="text-destructive hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div>
                        <Label className="text-xs">Address</Label>
                        <Input
                          value={acc.address}
                          onChange={(e) => updateAccommodation(index, "address", e.target.value)}
                          placeholder="Full address"
                          className="h-8"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">WiFi Password</Label>
                          <Input
                            value={acc.wifi_password}
                            onChange={(e) => updateAccommodation(index, "wifi_password", e.target.value)}
                            placeholder="WiFi password"
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Door Code</Label>
                          <Input
                            value={acc.door_code}
                            onChange={(e) => updateAccommodation(index, "door_code", e.target.value)}
                            placeholder="Door code"
                            className="h-8"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          value={acc.notes}
                          onChange={(e) => updateAccommodation(index, "notes", e.target.value)}
                          placeholder="Any additional notes..."
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DrawerFooter className="border-t">
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving..." : isEditing ? "Update Blitz" : "Create Blitz"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
