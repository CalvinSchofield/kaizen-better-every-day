import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { CalendarIcon, GripVertical, Plus, Minus, Trash2, Eye, EyeOff, Bell, RotateCcw, Save, LogOut } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/utils/dateUtils";
import { useRepData } from "@/hooks/useRepData";
import { useUnifiedPushNotifications } from "@/hooks/useUnifiedPushNotifications";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useIntroStatus } from "@/hooks/useIntroStatus";
import { resetAllTours } from "@/hooks/usePageTour";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { IntroWizard } from "@/components/IntroWizard";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useOnboardingSegment } from "@/hooks/useOnboardingSegment";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { NotificationSettings } from "@/components/NotificationSettings";
import { MeVsMeSettings } from "@/components/MeVsMeSettings";
import { useWeeklyReports } from "@/hooks/useWeeklyReports";
import { TeamRecapStory } from "@/components/team-recap";
import { PastRecapsSection } from "@/components/recap/PastRecapsSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCumulativeFP } from "@/hooks/useCumulativeFP";
import { Separator } from "@/components/ui/separator";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { useMeVsMe } from "@/hooks/useMeVsMe";

// Payscale tier options for recap
const RECAP_TIER_OPTIONS = [60, 100, 150, 200, 250, 300];

interface CustomCounter {
  id: string;
  name: string;
  emoji: string;
  hidden?: boolean;
}

interface CounterLayoutConfig {
  order: string[];
}

const DEFAULT_COUNTER_ORDER = [
  'doors_knocked',
  'decision_makers',
  'pitches',
  'transitions',
  'presentations',
  'closes'
];

const COUNTER_LABELS: Record<string, string> = {
  doors_knocked: "Doors Knocked",
  decision_makers: "Decision Makers",
  pitches: "Pitches",
  transitions: "Transitions",
  presentations: "Presentations",
  closes: "Closes"
};

export default function Settings() {
  const { repData } = useRepData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { goals, updateGoals: updateRepGoals, isUpdating: isUpdatingGoals } = useRepGoals();
  const { resetIntro, markIntroComplete } = useIntroStatus(repData?.user_id);
  const teamAccess = useTeamAccess();
  const { data: cumulativeData } = useCumulativeFP();
  const isLeader = teamAccess.data?.accessLevel && teamAccess.data.accessLevel !== 'none';
  const { segment: onboardingSegment } = useOnboardingSegment(repData);
  const { isEnabled: meVsMeEnabled, isLoading: meVsMeLoading, toggleEnabled: toggleMeVsMe, isToggling: isTogglingMeVsMe } = useMeVsMe();
  
  const userCumulativeFpPlus = cumulativeData && cumulativeData.length > 0 
    ? cumulativeData[cumulativeData.length - 1].cumulativeFp 
    : 0;
  
  // Drawer states
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [counterName, setCounterName] = useState("");
  const [counterEmoji, setCounterEmoji] = useState("📊");
  const [deleteConfirmCounter, setDeleteConfirmCounter] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drawer-based section states
  const [summerDrawerOpen, setSummerDrawerOpen] = useState(false);
  const [cancelRateDrawerOpen, setCancelRateDrawerOpen] = useState(false);
  const [countersDrawerOpen, setCountersDrawerOpen] = useState(false);
  const [notificationsDrawerOpen, setNotificationsDrawerOpen] = useState(false);
  const [recapsDrawerOpen, setRecapsDrawerOpen] = useState(false);
  const [meVsMeDrawerOpen, setMeVsMeDrawerOpen] = useState(false);
  const [devToolsDrawerOpen, setDevToolsDrawerOpen] = useState(false);
  
  // Intro wizard state
  const [showIntroWizard, setShowIntroWizard] = useState(false);
  
  // Profile state
  const [name, setName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [hasProfileChanges, setHasProfileChanges] = useState(false);
  
  // Summer dates state
  const [summerStart, setSummerStart] = useState<Date>();
  const [summerEnd, setSummerEnd] = useState<Date>();
  const [isSavingSummer, setIsSavingSummer] = useState(false);
  
  // EFP mode state
  const [isSavingEfp, setIsSavingEfp] = useState(false);
  
  // Sales Logger state
  const [isSavingSalesLogger, setIsSavingSalesLogger] = useState(false);
  
  // Counter layout state
  const [counterLayout, setCounterLayout] = useState<CounterLayoutConfig>({
    order: DEFAULT_COUNTER_ORDER
  });
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [draggedCounter, setDraggedCounter] = useState<string | null>(null);
  
  // Cancel rate
  const [cancelRate, setCancelRate] = useState(10);
  const [isSavingCancelRate, setIsSavingCancelRate] = useState(false);
  
  // Push notifications
  const {
    isSupported: notificationsSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: notificationsLoading,
    isNative,
    platform,
    debug: pushDebug,
    refreshStoredTokenFlag,
  } = useUnifiedPushNotifications();
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [apnsTokenCount, setApnsTokenCount] = useState<number | null>(null);
  const [isCheckingApnsToken, setIsCheckingApnsToken] = useState(false);

  // Recaps
  const [showTeamRecapStory, setShowTeamRecapStory] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { data: publishedReports } = useWeeklyReports('published');

  const canAddCustomCounters = repData?.year === "Vet" || repData?.year === "Sophomore";
  const isVet = repData?.year === "Vet";
  const customCounters: CustomCounter[] = Array.isArray(repData?.custom_counter_config) 
    ? (repData.custom_counter_config as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        hidden: c.hidden || false,
      }))
    : [];
  const maxCounters = 6;
  const canAddMore = customCounters.length < maxCounters;
  
  // Load profile values
  useEffect(() => {
    if (repData) {
      setName(repData.name || "");
    }
  }, [repData]);

  useEffect(() => {
    if (repData) {
      const nameChanged = name !== (repData.name || "");
      setHasProfileChanges(nameChanged);
    }
  }, [name, repData]);
  
  // Load summer dates and layout config
  useEffect(() => {
    const loadUserData = async () => {
      if (!repData?.user_id) return;
      
      const { data: seasonConfig } = await supabase
        .from('season_config')
        .select('*')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      
      if (seasonConfig) {
        if (seasonConfig.personal_summer_start) {
          setSummerStart(parseLocalDate(seasonConfig.personal_summer_start));
        }
        if (seasonConfig.personal_summer_end) {
          setSummerEnd(parseLocalDate(seasonConfig.personal_summer_end));
        }
      }
      
      if ((repData as any).counter_layout_config) {
        setCounterLayout((repData as any).counter_layout_config as CounterLayoutConfig);
      }
    };
    
    loadUserData();
  }, [repData]);

  useEffect(() => {
    if (goals?.cancel_rate !== undefined) {
      setCancelRate(Math.round(goals.cancel_rate * 100));
    }
  }, [goals?.cancel_rate]);

  // ── Handlers (unchanged) ──────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!repData?.id) return;
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter your name", variant: "destructive" });
      return;
    }
    setIsSavingProfile(true);
    try {
      const { error } = await supabase.from('reps').update({ name: name.trim() }).eq('id', repData.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toast({ title: "Profile updated", description: "Your changes have been saved" });
      setHasProfileChanges(false);
    } catch (error: any) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpdate = (_url: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['rep-data'] });
    queryClient.invalidateQueries({ queryKey: ['rookie-of-week'] });
  };

  const handleSaveCancelRate = async (newRate: number) => {
    setIsSavingCancelRate(true);
    try {
      await updateRepGoals({ cancel_rate: newRate / 100 });
      toast({ title: "Cancel rate saved", description: `Set to ${newRate}%` });
    } catch (error: any) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingCancelRate(false);
    }
  };

  const handleAddCounter = async () => {
    if (!counterName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for your counter", variant: "destructive" });
      return;
    }
    if (counterName.length > 20) {
      toast({ title: "Name too long", description: "Counter names must be 20 characters or less", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const newCounter: CustomCounter = { id: crypto.randomUUID(), name: counterName.trim(), emoji: counterEmoji || "📊", hidden: false };
      const updatedCounters = [...customCounters, newCounter];
      const { error } = await supabase.from("reps").update({ custom_counter_config: updatedCounters as any }).eq("id", repData?.id).select();
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
      toast({ title: "Counter added", description: `${newCounter.emoji} ${newCounter.name} has been added` });
      setCounterName(""); setCounterEmoji("📊"); setShowAddSheet(false);
    } catch (error: any) {
      toast({ title: "Failed to add counter", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCounter = async (counterId: string) => {
    try {
      const updatedCounters = customCounters.filter(c => c.id !== counterId);
      const updatedOrder = counterLayout.order.filter(id => id !== `custom_${counterId}`);
      const { error } = await supabase.from('reps').update({ custom_counter_config: updatedCounters as any, counter_layout_config: { order: updatedOrder } as any }).eq('id', repData?.id);
      if (error) throw error;
      toast({ title: "Counter deleted" });
      setDeleteConfirmCounter(null);
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete counter.", variant: "destructive" });
    }
  };

  const handleToggleCounterVisibility = async (counterId: string) => {
    try {
      const updatedCounters = customCounters.map(c => c.id === counterId ? { ...c, hidden: !c.hidden } : c);
      const { error } = await supabase.from('reps').update({ custom_counter_config: updatedCounters as any }).eq('id', repData?.id);
      if (error) throw error;
      const wasHidden = customCounters.find(c => c.id === counterId)?.hidden;
      toast({ title: wasHidden ? "Counter visible" : "Counter hidden" });
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update counter visibility.", variant: "destructive" });
    }
  };

  const handleSaveSummerDates = async () => {
    if (!summerStart || !summerEnd) {
      toast({ title: "Dates required", description: "Please select both start and end dates", variant: "destructive" });
      return;
    }
    const minDate = new Date('2026-04-12');
    const maxDate = new Date('2026-09-27');
    if (summerStart < minDate || summerStart > maxDate || summerEnd < minDate || summerEnd > maxDate) {
      toast({ title: "Invalid dates", description: "Dates must be between April 12 and September 27, 2026", variant: "destructive" });
      return;
    }
    if (summerEnd < summerStart) {
      toast({ title: "Invalid date range", description: "End date must be after start date", variant: "destructive" });
      return;
    }
    setIsSavingSummer(true);
    const startDateStr = format(summerStart, 'yyyy-MM-dd');
    const endDateStr = format(summerEnd, 'yyyy-MM-dd');
    try {
      const { error } = await supabase.from('season_config').upsert({ user_id: repData?.user_id, personal_summer_start: startDateStr, personal_summer_end: endDateStr }, { onConflict: 'user_id' });
      if (error) throw error;
      if (repData?.id) {
        await supabase.functions.invoke('update-summer-dates', { body: { repId: repData.id, startDate: startDateStr, endDate: endDateStr } });
      }
      toast({ title: "Summer dates saved" });
    } catch (error: any) {
      toast({ title: "Failed to save dates", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingSummer(false);
    }
  };
  
  const handleToggleEfpMode = async (enabled: boolean) => {
    setIsSavingEfp(true);
    try {
      const { error } = await supabase.from('reps').update({ efp_mode_enabled: enabled }).eq('id', repData?.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toast({ title: enabled ? "EFP mode enabled" : "EFP mode disabled", description: enabled ? "EFP is now your primary metric" : "FP+ is now your primary metric" });
    } catch (error: any) {
      toast({ title: "Failed to update EFP mode", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingEfp(false);
    }
  };
  
  const handleDragStart = (counterId: string) => { setDraggedCounter(counterId); };
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCounter || draggedCounter === targetId) return;
    const allCounterIds = [...counterLayout.order, ...customCounters.map(c => `custom_${c.id}`)];
    const draggedIndex = allCounterIds.indexOf(draggedCounter);
    const targetIndex = allCounterIds.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const reordered = [...allCounterIds];
    reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedCounter);
    setCounterLayout({ order: reordered });
  };
  const handleDragEnd = () => { setDraggedCounter(null); };
  
  const handleSaveCounterLayout = async () => {
    setIsSavingLayout(true);
    try {
      const { error } = await supabase.from('reps').update({ counter_layout_config: counterLayout as any }).eq('id', repData?.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
      toast({ title: "Layout saved" });
    } catch (error: any) {
      toast({ title: "Failed to save layout", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const commonEmojis = ["📊", "📈", "📞", "🎯", "✅", "💰", "📝", "🔥", "⭐", "💪"];

  const handleToggleNotifications = async (enabled: boolean) => {
    setIsSavingNotifications(true);
    try {
      if (enabled) {
        const success = await subscribe();
        if (success) { toast({ title: "Notifications enabled" }); }
        else { toast({ title: "Could not enable notifications", description: "Check your browser settings.", variant: "destructive" }); }
      } else {
        const success = await unsubscribe();
        if (success) { toast({ title: "Notifications disabled" }); }
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update notification settings.", variant: "destructive" });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Build ordered counters list
  const orderedCounters = [
    ...counterLayout.order.map(id => {
      if (id.startsWith('custom_')) {
        const customId = id.replace('custom_', '');
        const counter = customCounters.find(c => c.id === customId);
        return counter ? { id, emoji: counter.emoji, name: counter.name, isCustom: true, hidden: counter.hidden } : null;
      }
      return { id, emoji: '', name: COUNTER_LABELS[id], isCustom: false, hidden: false };
    }).filter(Boolean),
    ...customCounters
      .filter(c => !counterLayout.order.includes(`custom_${c.id}`))
      .map(c => ({ id: `custom_${c.id}`, emoji: c.emoji, name: c.name, isCustom: true, hidden: c.hidden }))
  ] as Array<{ id: string; emoji: string; name: string; isCustom: boolean; hidden?: boolean }>;

  const getUserType = (): 'pre-blitz-rookie' | 'post-blitz-rookie' | 'vet' | 'leader' => {
    const year = repData?.year || "Rookie";
    const isVetOrSoph = year === "Vet" || year === "Sophomore";
    const committedBlitzes = (repData?.committed_blitzes as any[]) || [];
    const hasAttendedBlitz = committedBlitzes.some((blitz: any) => {
      if (!blitz?.endDate) return false;
      return new Date(blitz.endDate) < new Date();
    });
    const phase = repData?.ramp_to_blitz_phase || "Not started";
    const phaseLower = phase.toLowerCase();
    const phase4Complete = phaseLower.includes("phase 4") && phaseLower.includes("✅");
    if (isLeader && isVetOrSoph) return 'leader';
    if (isVetOrSoph) return 'vet';
    if (year === "Rookie" && phase4Complete && hasAttendedBlitz) return 'post-blitz-rookie';
    return 'pre-blitz-rookie';
  };

  const handleShowIntro = () => { setShowIntroWizard(true); };
  const handleIntroComplete = () => { setShowIntroWizard(false); markIntroComplete(); };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Show intro wizard if requested
  if (showIntroWizard && repData) {
    const firstName = repData.name?.split(' ')[0] || 'there';
    return (
      <IntroWizard
        userType={getUserType()}
        firstName={firstName}
        onComplete={handleIntroComplete}
        segment={onboardingSegment}
        isLeader={!!isLeader}
      />
    );
  }

  const summerDatesSummary = summerStart && summerEnd
    ? `${format(summerStart, 'MMM d')} – ${format(summerEnd, 'MMM d')}`
    : 'Not set';

  const notificationStatus = isSubscribed ? "On" : permission === 'denied' ? "Blocked" : "Off";

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-lg mx-auto space-y-6 pt-6 px-4">

        {/* ── Profile Hero ────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 py-4">
          <ProfilePhotoUpload
            currentPhotoUrl={repData?.profile_photo_url}
            name={repData?.name || "User"}
            onPhotoUpdated={handlePhotoUpdate}
            size="lg"
            showRemoveButton={false}
          />
          <div className="w-full max-w-[220px] space-y-1 text-center">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="text-center text-lg font-semibold h-10 border-0 bg-transparent shadow-none focus-visible:ring-1"
            />
            <p className="text-xs text-muted-foreground">
              {repData?.year || "Rep"}{repData?.team_name ? ` · ${repData.team_name}` : ''}
            </p>
          </div>
          {hasProfileChanges && (
            <Button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              size="sm"
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingProfile ? "Saving..." : "Save"}
            </Button>
          )}
        </div>

        {/* ── Account ─────────────────────────────────────── */}
        <SettingsSection label="Account">
          <SettingsRow
            icon="☀️"
            title="Summer Season"
            value={summerDatesSummary}
            onClick={() => setSummerDrawerOpen(true)}
          />
          <SettingsRow
            icon="🎯"
            title="Preseason Commitments"
            subtitle="Training, books, blitzes & more"
            onClick={() => navigate('/goals')}
          />
        </SettingsSection>

        {/* ── Tracking (Vets/Sophomores) ──────────────────── */}
        {isVet && (
          <SettingsSection label="Tracking">
            <SettingsRow
              icon="📊"
              title="EFP Mode"
              subtitle="Use EFP as primary metric"
              toggle={{
                checked: repData?.efp_mode_enabled || false,
                onCheckedChange: handleToggleEfpMode,
                disabled: isSavingEfp,
              }}
            />
            <SettingsRow
              icon="📉"
              title="Cancel/Unfunded Rate"
              value={`${cancelRate}%`}
              onClick={() => setCancelRateDrawerOpen(true)}
            />
            {canAddCustomCounters && (
              <SettingsRow
                icon="🔢"
                title="Custom Counters"
                value={`${customCounters.length}`}
                onClick={() => setCountersDrawerOpen(true)}
              />
            )}
            <SettingsRow
              icon="📋"
              title="Sales Logger"
              subtitle="Log sale details when you close"
              toggle={{
                checked: repData?.sales_log_enabled || false,
                onCheckedChange: async (enabled) => {
                  setIsSavingSalesLogger(true);
                  try {
                    const { error } = await supabase.from('reps').update({ sales_log_enabled: enabled }).eq('id', repData?.id);
                    if (error) throw error;
                    await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
                    toast({ title: enabled ? "Sales Logger enabled" : "Sales Logger disabled" });
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  } finally {
                    setIsSavingSalesLogger(false);
                  }
                },
                disabled: isSavingSalesLogger,
              }}
            />
          </SettingsSection>
        )}

        {/* Non-vet counters */}
        {!isVet && canAddCustomCounters && (
          <SettingsSection label="Tracking">
            <SettingsRow
              icon="🔢"
              title="Custom Counters"
              value={`${customCounters.length}`}
              onClick={() => setCountersDrawerOpen(true)}
            />
          </SettingsSection>
        )}

        {/* ── Me vs Me (vets/sophomores) ──────────────────── */}
        {repData?.year !== 'Rookie' && (
          <SettingsSection label="Me vs Me">
            <SettingsRow
              icon="🏆"
              title="Year-over-Year"
              subtitle="Compare with last season"
              toggle={{
                checked: meVsMeEnabled,
                onCheckedChange: (checked) => { toggleMeVsMe(checked); },
                disabled: isTogglingMeVsMe || meVsMeLoading,
              }}
            />
            {meVsMeEnabled && (
              <SettingsRow
                icon="📂"
                title="Manage Data"
                subtitle="Import or delete historical data"
                onClick={() => setMeVsMeDrawerOpen(true)}
              />
            )}
          </SettingsSection>
        )}

        {/* ── Notifications ───────────────────────────────── */}
        <SettingsSection label="Notifications">
          <SettingsRow
            icon="🔔"
            title="Push Notifications"
            value={notificationStatus}
            onClick={() => setNotificationsDrawerOpen(true)}
          />
        </SettingsSection>

        {/* ── Recaps ──────────────────────────────────────── */}
        <SettingsSection label="Recaps">
          <SettingsRow
            icon="💰"
            title="Pay Level"
            onClick={() => setRecapsDrawerOpen(true)}
          >
            <Select
              value={String(goals?.custom_payscale_fp ?? (repData?.year === 'Rookie' ? 60 : 100))}
              onValueChange={(value) => { updateRepGoals({ custom_payscale_fp: parseInt(value) }); }}
            >
              <SelectTrigger className="w-24 h-8 text-xs border-0 bg-transparent shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userCumulativeFpPlus > 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
                    Current: {Math.round(userCumulativeFpPlus)} FP+
                  </div>
                )}
                {RECAP_TIER_OPTIONS.map((tier) => {
                  const isDisabled = tier < userCumulativeFpPlus;
                  return (
                    <SelectItem key={tier} value={String(tier)} disabled={isDisabled} className={isDisabled ? 'opacity-50' : ''}>
                      {tier} FP+
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            icon="📖"
            title="Past Recaps"
            subtitle="Weekly & monthly summaries"
            onClick={() => setRecapsDrawerOpen(true)}
          />
          {publishedReports && publishedReports.length > 0 && (
            <SettingsRow
              icon="✨"
              title="Team Recaps"
              value={`${publishedReports.length}`}
              onClick={() => setRecapsDrawerOpen(true)}
            />
          )}
        </SettingsSection>

        {/* ── About ───────────────────────────────────────── */}
        <SettingsSection label="About">
          <SettingsRow
            icon="🔄"
            title="Replay Intro"
            subtitle="Watch the welcome walkthrough again"
            onClick={handleShowIntro}
          />
          <SettingsRow
            icon="🗺️"
            title="Reset Page Tours"
            subtitle="See guided tips on each page"
            onClick={async () => {
              if (repData?.user_id) {
                await resetAllTours(repData.user_id);
                queryClient.invalidateQueries({ queryKey: ['rep-data'] });
                toast({ title: "Tours reset!", description: "You'll see guided tours again on each page." });
              }
            }}
          />
          {repData?.email?.toLowerCase() === 'calvinjschofield@gmail.com' && (
            <SettingsRow
              icon="🧪"
              title="Developer Tools"
              subtitle="Test & debug"
              onClick={() => setDevToolsDrawerOpen(true)}
            />
          )}
        </SettingsSection>

        {/* ── Sign Out ────────────────────────────────────── */}
        <SettingsSection>
          <SettingsRow
            icon="👋"
            title="Sign Out"
            destructive
            onClick={handleSignOut}
          />
        </SettingsSection>

        <div className="h-4" />
      </div>

      {/* ═══════════════════════════════════════════════════
          DRAWERS
         ═══════════════════════════════════════════════════ */}

      {/* Summer Dates Drawer */}
      <Drawer open={summerDrawerOpen} onOpenChange={setSummerDrawerOpen}>
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>Summer Season Dates</DrawerTitle>
            <DrawerDescription>Set your personal summer start & end dates</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 space-y-4 pb-6">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {summerStart ? format(summerStart, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={summerStart}
                    onSelect={setSummerStart}
                    disabled={(date) => date < new Date('2026-04-12') || date > new Date('2026-09-27') || !!(summerEnd && date > summerEnd)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {summerEnd ? format(summerEnd, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={summerEnd}
                    onSelect={setSummerEnd}
                    disabled={(date) => date < new Date('2026-04-12') || date > new Date('2026-09-27') || !!(summerStart && date < summerStart)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleSaveSummerDates} disabled={!summerStart || !summerEnd || isSavingSummer} className="w-full">
              {isSavingSummer ? "Saving..." : "Save Summer Dates"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Used for your personal goal calculations
            </p>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Cancel Rate Drawer */}
      <Drawer open={cancelRateDrawerOpen} onOpenChange={setCancelRateDrawerOpen}>
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>Cancel/Unfunded Rate</DrawerTitle>
            <DrawerDescription>Adjust goals to account for expected cancellations</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 space-y-5 pb-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
              <div>
                <p className="font-semibold">Cancel Rate</p>
                <p className="text-sm text-muted-foreground">
                  Sell {((1 / (1 - cancelRate / 100)) * 100).toFixed(0)}% of goal to hit target
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-9 w-9 rounded-full"
                  onClick={() => { const r = Math.max(5, cancelRate - 1); setCancelRate(r); handleSaveCancelRate(r); }}
                  disabled={cancelRate <= 5 || isSavingCancelRate}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-bold w-12 text-center tabular-nums">{cancelRate}%</span>
                <Button
                  variant="outline" size="icon" className="h-9 w-9 rounded-full"
                  onClick={() => { const r = Math.min(15, cancelRate + 1); setCancelRate(r); handleSaveCancelRate(r); }}
                  disabled={cancelRate >= 15 || isSavingCancelRate}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-xs font-medium">Example</p>
              <p className="text-sm text-muted-foreground">
                Goal: <span className="font-semibold text-foreground">100 FP+ funded</span> → sell <span className="font-semibold text-foreground">{Math.round(100 / (1 - cancelRate / 100))} FP+</span> after {cancelRate}% cancel.
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Counters Drawer */}
      <Drawer open={countersDrawerOpen} onOpenChange={setCountersDrawerOpen}>
        <DrawerContent className="pb-safe max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Track Counters</DrawerTitle>
            <DrawerDescription>Reorder & manage your counters</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 space-y-4 pb-6 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              Core counters feed team leaderboards. Custom counters appear only in your personal Insights.
            </p>
            <div className="space-y-2">
              {orderedCounters.map((counter) => (
                <div
                  key={counter.id}
                  draggable
                  onDragStart={() => handleDragStart(counter.id)}
                  onDragOver={(e) => handleDragOver(e, counter.id)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-3 p-3 border rounded-lg bg-card border-border transition-opacity ${draggedCounter === counter.id ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                  <span className="flex-1 font-medium flex items-center gap-2 text-sm">
                    {counter.emoji && <span className="text-lg">{counter.emoji}</span>}
                    {counter.name}
                  </span>
                  {!counter.isCustom && (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">Core</span>
                  )}
                  {counter.isCustom && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleToggleCounterVisibility(counter.id.replace('custom_', '')); }}>
                        {counter.hidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteConfirmCounter(counter.id.replace('custom_', '')); }}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={handleSaveCounterLayout} disabled={isSavingLayout} size="sm" className="w-full">
              {isSavingLayout ? "Saving..." : "Save Counter Order"}
            </Button>
            <Separator />
            {canAddMore ? (
              <Button variant="outline" className="w-full" onClick={() => setShowAddSheet(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Counter ({customCounters.length}/{maxCounters})
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground text-center">Maximum of {maxCounters} custom counters reached</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Notifications Drawer */}
      <Drawer open={notificationsDrawerOpen} onOpenChange={setNotificationsDrawerOpen}>
        <DrawerContent className="pb-safe max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Notifications</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <NotificationSettings />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Recaps Drawer */}
      <Drawer open={recapsDrawerOpen} onOpenChange={setRecapsDrawerOpen}>
        <DrawerContent className="pb-safe max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Recaps</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-6 overflow-y-auto">
            <PastRecapsSection />
            
            {publishedReports && publishedReports.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Team Recaps</h3>
                  {publishedReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelectedReport(report);
                        setShowTeamRecapStory(true);
                        setRecapsDrawerOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      <span className="text-lg">✨</span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">
                          {report.report_type === 'weekly' ? 'Weekly' : report.report_type === 'monthly' ? 'Monthly' : 'Blitz'} Recap
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(report.period_start), 'MMM d')} - {format(new Date(report.period_end), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Me vs Me Drawer */}
      <Drawer open={meVsMeDrawerOpen} onOpenChange={setMeVsMeDrawerOpen}>
        <DrawerContent className="pb-safe max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Me vs Me — Manage Data</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <MeVsMeSettings isOpen={true} onOpenChange={() => {}} />
          </DrawerContent>
        </Drawer>
      </Drawer>

      {/* Developer Tools Drawer */}
      {repData?.email?.toLowerCase() === 'calvinjschofield@gmail.com' && (
        <Drawer open={devToolsDrawerOpen} onOpenChange={setDevToolsDrawerOpen}>
          <DrawerContent className="pb-safe max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>🧪 Developer Tools</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-3 overflow-y-auto">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Notifications</h4>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={isSendingTestPush}
                onClick={async () => {
                  setIsSendingTestPush(true);
                  try {
                    const { session } = await getSessionSafe();
                    const currentUserId = session?.user?.id;
                    const { count } = await supabase.from('apns_device_tokens').select('id', { count: 'exact', head: true }).eq('user_id', currentUserId ?? '');
                    const tokenCount = count ?? 0;
                    setApnsTokenCount(tokenCount);
                    const webPromise = supabase.functions.invoke('test-push-notification', { body: { targetEmail: 'calvinjschofield@gmail.com' } });
                    const apnsPromise = tokenCount > 0
                      ? supabase.functions.invoke('send-apns-notification', { body: { targetEmail: 'calvinjschofield@gmail.com', title: '🧪 Native Test', body: 'Test notification!', type: 'test' } })
                      : Promise.resolve({ data: { success: false }, error: null } as any);
                    const [webRes, apnsRes] = await Promise.all([webPromise, apnsPromise]);
                    const webOk = !webRes.error && webRes.data?.success !== false;
                    const apnsOk = tokenCount > 0 && !apnsRes.error && apnsRes.data?.success === true;
                    toast({ title: "Test sent", description: `Web: ${webOk ? '✓' : '✗'} | APNs: ${apnsOk ? '✓' : tokenCount > 0 ? '✗' : '—'}` });
                  } catch (err: any) {
                    toast({ title: "Failed", description: err.message, variant: "destructive" });
                  } finally { setIsSendingTestPush(false); }
                }}
              >🔔 Rich Notification (Both)</Button>

              <Button variant="outline" size="sm" className="w-full justify-start" disabled={isSendingTestPush}
                onClick={async () => {
                  setIsSendingTestPush(true);
                  try { await supabase.functions.invoke('check-inactivity-notifications'); toast({ title: "Inactivity check triggered" }); }
                  catch (err: any) { toast({ title: "Failed", description: err.message, variant: "destructive" }); }
                  finally { setIsSendingTestPush(false); }
                }}
              >⏰ Inactivity Nudge</Button>

              <Button variant="outline" size="sm" className="w-full justify-start" disabled={isSendingTestPush}
                onClick={async () => {
                  setIsSendingTestPush(true);
                  try { await supabase.functions.invoke('check-blitz-rsvp-reminders'); toast({ title: "RSVP reminder check triggered" }); }
                  catch (err: any) { toast({ title: "Failed", description: err.message, variant: "destructive" }); }
                  finally { setIsSendingTestPush(false); }
                }}
              >📅 Blitz RSVP Reminder</Button>

              <Button variant="outline" size="sm" className="w-full justify-start" disabled={isSendingTestPush}
                onClick={async () => {
                  setIsSendingTestPush(true);
                  try { await supabase.functions.invoke('check-ramp-progress-notifications'); toast({ title: "Ramp progress check triggered" }); }
                  catch (err: any) { toast({ title: "Failed", description: err.message, variant: "destructive" }); }
                  finally { setIsSendingTestPush(false); }
                }}
              >🚀 Ramp to Blitz Nudge</Button>

              <Button variant="outline" size="sm" className="w-full justify-start" disabled={isSendingTestPush}
                onClick={async () => {
                  setIsSendingTestPush(true);
                  try { await supabase.functions.invoke('check-preseason-accountability'); toast({ title: "Preseason accountability check triggered" }); }
                  catch (err: any) { toast({ title: "Failed", description: err.message, variant: "destructive" }); }
                  finally { setIsSendingTestPush(false); }
                }}
              >📊 Preseason Accountability</Button>

              <Separator />
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legacy & Debug</h4>
              <Link to="/team-reports"><Button variant="outline" size="sm" className="w-full justify-start">📊 Reports V1 (Legacy)</Button></Link>
              <Link to="/debug-notifications"><Button variant="outline" size="sm" className="w-full justify-start">🧪 Notification Tester</Button></Link>
              <Button variant="outline" size="sm" className="w-full justify-start"
                onClick={() => {
                  const keysToRemove: string[] = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('rep-data-cache') || key.startsWith('competitors-cache') || key.startsWith('blitzes-cache') || key.startsWith('team-access-cache') || key.startsWith('season-config-cache') || key.startsWith('group-recruits-cache') || key.startsWith('blitz-attendance-cache') || key.startsWith('kaizen-') || key.startsWith('REACT_QUERY'))) {
                      keysToRemove.push(key);
                    }
                  }
                  keysToRemove.forEach(key => localStorage.removeItem(key));
                  queryClient.clear();
                  toast({ title: "Refreshing...", description: "Cache cleared" });
                  setTimeout(() => window.location.reload(), 500);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />Force Refresh
              </Button>

              {platform === 'native' && (
                <>
                  <Button variant="outline" size="sm" className="w-full justify-start" disabled={isCheckingApnsToken}
                    onClick={async () => {
                      setIsCheckingApnsToken(true);
                      try {
                        const { data: { session: s } } = await supabase.auth.getSession();
                        const uid = s?.user?.id;
                        const { count, error } = await supabase.from('apns_device_tokens').select('id', { count: 'exact', head: true }).eq('user_id', uid ?? '');
                        if (error) throw error;
                        const c = count ?? 0;
                        setApnsTokenCount(c);
                        toast({ title: 'APNs token check', description: c > 0 ? `Found ${c} token(s).` : 'No token stored.', variant: c > 0 ? undefined : 'destructive' });
                      } catch (err: any) { toast({ title: 'Check failed', description: err.message, variant: 'destructive' }); }
                      finally { setIsCheckingApnsToken(false); }
                    }}
                  ><Bell className="h-4 w-4 mr-2" />{isCheckingApnsToken ? 'Checking…' : 'Check APNs Token'}</Button>

                  <Button variant="default" size="sm" className="w-full justify-start" disabled={isSendingTestPush}
                    onClick={async () => {
                      setIsSendingTestPush(true);
                      try {
                        toast({ title: '0/4 Resetting push…' });
                        await unsubscribe();
                        toast({ title: '1/4 Requesting permission…' });
                        const registered = await subscribe();
                        if (!registered) { toast({ title: 'Registration failed', variant: 'destructive' }); return; }
                        toast({ title: '2/4 Waiting for token…' });
                        const deadline = Date.now() + 12_000;
                        let tokenCount = 0;
                        while (Date.now() < deadline) {
                          const { data: { session: ps } } = await supabase.auth.getSession();
                          const { count } = await supabase.from('apns_device_tokens').select('id', { count: 'exact', head: true }).eq('user_id', ps?.user?.id ?? '');
                          tokenCount = count ?? 0;
                          if (tokenCount > 0) break;
                          await new Promise(r => setTimeout(r, 1000));
                        }
                        toast({ title: '3/4 Checking token…' });
                        setApnsTokenCount(tokenCount);
                        if (tokenCount === 0) { toast({ title: 'Token not stored', variant: 'destructive' }); return; }
                        toast({ title: '4/4 Sending test…' });
                        const { data, error } = await supabase.functions.invoke('send-apns-notification', {
                          body: { targetEmail: 'calvinjschofield@gmail.com', title: '🧪 Self-Test', body: 'Push works end-to-end!', type: 'test' },
                        });
                        toast({ title: data?.success ? '✅ Push delivered!' : '❌ Push failed', description: data?.error || error?.message, variant: data?.success ? undefined : 'destructive' });
                      } catch (err: any) { toast({ title: 'Failed', description: err.message, variant: 'destructive' }); }
                      finally { setIsSendingTestPush(false); }
                    }}
                  ><Bell className="h-4 w-4 mr-2" />Re-register & Self-Test Push</Button>
                </>
              )}

              <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded space-y-1">
                <p><strong>Platform:</strong> {platform}</p>
                <p><strong>Push Registered:</strong> {isSubscribed ? 'Yes' : 'No'}</p>
                <p><strong>Permission:</strong> {permission}</p>
                {platform === 'native' && (
                  <>
                    <p><strong>APNs token in DB:</strong> {apnsTokenCount === null ? 'Unknown' : apnsTokenCount > 0 ? 'Yes' : 'No'}</p>
                    <p><strong>Phase:</strong> {pushDebug?.phase ?? '—'}</p>
                    {pushDebug?.lastTokenPrefix && <p><strong>Last token:</strong> {pushDebug.lastTokenPrefix}…</p>}
                    {pushDebug?.lastTokenStoreError && <p className="text-destructive"><strong>Token store error:</strong> {pushDebug.lastTokenStoreError}</p>}
                    {pushDebug?.lastRegistrationError && <p className="text-destructive"><strong>Registration error:</strong> {pushDebug.lastRegistrationError}</p>}
                  </>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add Counter Drawer */}
      <Drawer open={showAddSheet} onOpenChange={setShowAddSheet}>
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>Add Custom Counter</DrawerTitle>
            <DrawerDescription>Create a custom counter to track additional metrics.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 mt-2 px-4 pb-4">
            <div>
              <Label htmlFor="counter-name">Counter Name</Label>
              <Input id="counter-name" placeholder="e.g., Referrals" value={counterName} onChange={(e) => setCounterName(e.target.value)} maxLength={20} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{counterName.length}/20 characters</p>
            </div>
            <div>
              <Label>Emoji (Optional)</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {commonEmojis.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setCounterEmoji(emoji)}
                    className={`p-3 text-2xl border rounded-lg transition-colors ${counterEmoji === emoji ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                  >{emoji}</button>
                ))}
              </div>
            </div>
            <Button className="w-full py-6 text-lg font-semibold" onClick={handleAddCounter} disabled={!counterName.trim() || isSaving} size="lg">
              {isSaving ? "Adding..." : "Add Counter"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer open={deleteConfirmCounter !== null} onOpenChange={(open) => !open && setDeleteConfirmCounter(null)}>
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>Delete Counter?</DrawerTitle>
            <DrawerDescription>This will permanently delete this custom counter.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Button onClick={() => deleteConfirmCounter && handleDeleteCounter(deleteConfirmCounter)} variant="destructive" className="w-full py-6 text-lg font-semibold" size="lg">Delete</Button>
            <Button onClick={() => setDeleteConfirmCounter(null)} variant="outline" className="w-full py-6 text-lg font-semibold" size="lg">Cancel</Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Team Recap Story Modal */}
      {showTeamRecapStory && selectedReport && (
        <TeamRecapStory
          report={selectedReport}
          onClose={() => { setShowTeamRecapStory(false); setSelectedReport(null); }}
        />
      )}
    </div>
  );
}
