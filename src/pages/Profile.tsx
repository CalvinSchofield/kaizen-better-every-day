import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Clock, BarChart3, Save } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useQueryClient } from "@tanstack/react-query";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

export default function Profile() {
  const { repData } = useRepData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [efpModeEnabled, setEfpModeEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load initial values
  useEffect(() => {
    if (repData) {
      setName(repData.name || "");
      setTimezone(repData.timezone || "America/Los_Angeles");
      setEfpModeEnabled(repData.efp_mode_enabled || false);
    }
  }, [repData]);

  // Track changes
  useEffect(() => {
    if (repData) {
      const nameChanged = name !== (repData.name || "");
      const timezoneChanged = timezone !== (repData.timezone || "America/Los_Angeles");
      const efpChanged = efpModeEnabled !== (repData.efp_mode_enabled || false);
      setHasChanges(nameChanged || timezoneChanged || efpChanged);
    }
  }, [name, timezone, efpModeEnabled, repData]);

  const handleSaveProfile = async () => {
    if (!repData?.id) return;
    
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({
          name: name.trim(),
          timezone,
          efp_mode_enabled: efpModeEnabled,
        })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully",
      });
      
      setHasChanges(false);
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpdate = (_url: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['rep-data'] });
    queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['rookie-of-week'] });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your profile and preferences
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile Photo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfilePhotoUpload
            currentPhotoUrl={repData?.profile_photo_url}
            name={repData?.name || "User"}
            onPhotoUpdated={handlePhotoUpdate}
          />
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="bg-background"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={repData?.email || ""}
              disabled
              className="bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for accurate time tracking and analytics
            </p>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="efp-mode" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                EFP Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Show EFP instead of FP+ in personal tracking views
              </p>
            </div>
            <Switch
              id="efp-mode"
              checked={efpModeEnabled}
              onCheckedChange={setEfpModeEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-20 px-4">
          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
