import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { CalendarIcon, GripVertical, Plus, Minus, Trash2, Eye, EyeOff, ChevronDown, Bell, Percent } from "lucide-react";
import { format } from "date-fns";
import { useRepData } from "@/hooks/useRepData";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useRepGoals } from "@/hooks/useRepGoals";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const { goals, updateGoals: updateRepGoals, isUpdating: isUpdatingGoals } = useRepGoals();
  
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [counterName, setCounterName] = useState("");
  const [counterEmoji, setCounterEmoji] = useState("📊");
  const [deleteConfirmCounter, setDeleteConfirmCounter] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Summer dates state
  const [summerStart, setSummerStart] = useState<Date>();
  const [summerEnd, setSummerEnd] = useState<Date>();
  const [isSavingSummer, setIsSavingSummer] = useState(false);
  
  // EFP mode state
  const [isSavingEfp, setIsSavingEfp] = useState(false);
  
  // Counter layout state
  const [counterLayout, setCounterLayout] = useState<CounterLayoutConfig>({
    order: DEFAULT_COUNTER_ORDER
  });
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [draggedCounter, setDraggedCounter] = useState<string | null>(null);
  
  // Push notifications
  const { isSupported: notificationsSupported, isSubscribed, permission, subscribe, unsubscribe, isLoading: notificationsLoading } = usePushNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  
  // Collapsible states
  const [isSummerDatesOpen, setIsSummerDatesOpen] = useState(false);
  const [isEfpModeOpen, setIsEfpModeOpen] = useState(false);
  const [isCancelRateOpen, setIsCancelRateOpen] = useState(false);
  const [cancelRate, setCancelRate] = useState(10); // percentage (5-15)
  const [isSavingCancelRate, setIsSavingCancelRate] = useState(false);
  const [isTrackCountersOpen, setIsTrackCountersOpen] = useState(false);
  const [isSalesLoggerOpen, setIsSalesLoggerOpen] = useState(false);
  const [isSavingSalesLogger, setIsSavingSalesLogger] = useState(false);

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
  
  // Load summer dates and EFP mode from database on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!repData?.user_id) return;
      
      // Load season config for summer dates
      const { data: seasonConfig } = await supabase
        .from('season_config')
        .select('*')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      
      if (seasonConfig) {
        if (seasonConfig.personal_summer_start) {
          setSummerStart(new Date(seasonConfig.personal_summer_start));
        }
        if (seasonConfig.personal_summer_end) {
          setSummerEnd(new Date(seasonConfig.personal_summer_end));
        }
      }
      
      // Load counter layout config
      if ((repData as any).counter_layout_config) {
        setCounterLayout((repData as any).counter_layout_config as CounterLayoutConfig);
      }
    };
    
    loadUserData();
  }, [repData]);

  // Load cancel rate from goals
  useEffect(() => {
    if (goals?.cancel_rate !== undefined) {
      setCancelRate(Math.round(goals.cancel_rate * 100));
    }
  }, [goals?.cancel_rate]);

  const handleSaveCancelRate = async (newRate: number) => {
    setIsSavingCancelRate(true);
    try {
      await updateRepGoals({ cancel_rate: newRate / 100 });
      toast({
        title: "Cancel rate saved",
        description: `Your cancel/unfunded rate has been set to ${newRate}%`,
      });
    } catch (error: any) {
      console.error("Error saving cancel rate:", error);
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingCancelRate(false);
    }
  };

  const handleAddCounter = async () => {
    if (!counterName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your counter",
        variant: "destructive",
      });
      return;
    }

    if (counterName.length > 20) {
      toast({
        title: "Name too long",
        description: "Counter names must be 20 characters or less",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const newCounter: CustomCounter = {
        id: crypto.randomUUID(),
        name: counterName.trim(),
        emoji: counterEmoji || "📊",
        hidden: false,
      };

      const updatedCounters = [...customCounters, newCounter];
      
      console.log("Adding counter:", newCounter);
      console.log("Updated counters array:", updatedCounters);

      const { data, error } = await supabase
        .from("reps")
        .update({ custom_counter_config: updatedCounters as any })
        .eq("id", repData?.id)
        .select();
      
      console.log("Supabase update response:", { data, error });

      if (error) throw error;

      // Force immediate refetch
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });

      toast({
        title: "Counter added",
        description: `${newCounter.emoji} ${newCounter.name} has been added to your Track page`,
      });

      setCounterName("");
      setCounterEmoji("📊");
      setShowAddSheet(false);
    } catch (error: any) {
      console.error("Error adding counter:", error);
      toast({
        title: "Failed to add counter",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCounter = async (counterId: string) => {
    try {
      const updatedCounters = customCounters.filter(c => c.id !== counterId);
      
      // Also remove from counter layout order
      const updatedOrder = counterLayout.order.filter(id => id !== `custom_${counterId}`);
      
      const { error } = await supabase
        .from('reps')
        .update({ 
          custom_counter_config: updatedCounters as any,
          counter_layout_config: { order: updatedOrder } as any
        })
        .eq('id', repData?.id);

      if (error) throw error;

      toast({
        title: "Counter deleted",
        description: "Custom counter has been removed.",
      });
      
      setDeleteConfirmCounter(null);
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
    } catch (error: any) {
      console.error('Error deleting counter:', error);
      toast({
        title: "Error",
        description: "Failed to delete counter. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleCounterVisibility = async (counterId: string) => {
    try {
      const updatedCounters = customCounters.map(c => 
        c.id === counterId ? { ...c, hidden: !c.hidden } : c
      );
      
      const { error } = await supabase
        .from('reps')
        .update({ 
          custom_counter_config: updatedCounters as any
        })
        .eq('id', repData?.id);

      if (error) throw error;

      const wasHidden = customCounters.find(c => c.id === counterId)?.hidden;

      toast({
        title: wasHidden ? "Counter visible" : "Counter hidden",
        description: wasHidden 
          ? "Counter is now visible on Track page." 
          : "Counter hidden from Track page.",
      });
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
    } catch (error: any) {
      console.error('Error toggling counter visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update counter visibility.",
        variant: "destructive",
      });
    }
  };

  const handleSaveSummerDates = async () => {
    if (!summerStart || !summerEnd) {
      toast({
        title: "Dates required",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }
    
    const minDate = new Date('2026-04-12');
    const maxDate = new Date('2026-09-27');
    
    if (summerStart < minDate || summerStart > maxDate || summerEnd < minDate || summerEnd > maxDate) {
      toast({
        title: "Invalid dates",
        description: "Dates must be between April 12, 2026 and September 27, 2026",
        variant: "destructive",
      });
      return;
    }
    
    if (summerEnd < summerStart) {
      toast({
        title: "Invalid date range",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingSummer(true);
    
    try {
      const { error } = await supabase
        .from('season_config')
        .upsert({
          user_id: repData?.user_id,
          personal_summer_start: format(summerStart, 'yyyy-MM-dd'),
          personal_summer_end: format(summerEnd, 'yyyy-MM-dd'),
        }, {
          onConflict: 'user_id'
        });
      
      if (error) throw error;
      
      toast({
        title: "Summer dates saved",
        description: "Your personal summer season has been updated",
      });
    } catch (error: any) {
      console.error("Error saving summer dates:", error);
      toast({
        title: "Failed to save dates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingSummer(false);
    }
  };
  
  const handleToggleEfpMode = async (enabled: boolean) => {
    setIsSavingEfp(true);
    
    try {
      // Optimistically update the UI immediately
      queryClient.setQueryData(['rep-data'], (old: any) => {
        if (!old) return old;
        return { ...old, efp_mode_enabled: enabled };
      });

      // Update localStorage cache immediately
      const cachedRep = localStorage.getItem('rep-data-cache');
      if (cachedRep) {
        try {
          const { data } = JSON.parse(cachedRep);
          localStorage.setItem('rep-data-cache', JSON.stringify({
            data: { ...data, efp_mode_enabled: enabled },
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error('Failed to update cache:', e);
        }
      }
      
      // Update database
      const { error } = await supabase
        .from('reps')
        .update({ efp_mode_enabled: enabled })
        .eq('id', repData?.id);
      
      if (error) throw error;
      
      toast({
        title: enabled ? "EFP mode enabled" : "EFP mode disabled",
        description: enabled 
          ? "EFP will now be your primary metric in Calendar and Insights"
          : "FP+ will now be your primary metric",
      });
    } catch (error: any) {
      console.error("Error toggling EFP mode:", error);
      
      // Revert optimistic update on error
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      
      toast({
        title: "Failed to update EFP mode",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingEfp(false);
    }
  };
  
  const handleDragStart = (counterId: string) => {
    setDraggedCounter(counterId);
  };
  
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCounter || draggedCounter === targetId) return;
    
    // Build a combined list of all counter IDs (core + custom)
    const allCounterIds = [
      ...counterLayout.order,
      ...customCounters.map(c => `custom_${c.id}`)
    ];
    
    const draggedIndex = allCounterIds.indexOf(draggedCounter);
    const targetIndex = allCounterIds.indexOf(targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Reorder the combined list
    const reordered = [...allCounterIds];
    reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedCounter);
    
    // Update order (includes both core and custom IDs)
    setCounterLayout({
      order: reordered
    });
  };
  
  const handleDragEnd = () => {
    setDraggedCounter(null);
  };
  
  const handleSaveCounterLayout = async () => {
    setIsSavingLayout(true);
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({ counter_layout_config: counterLayout as any })
        .eq('id', repData?.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      await queryClient.refetchQueries({ queryKey: ['rep-data'] });
      
      toast({
        title: "Layout saved",
        description: "Your counter layout has been updated",
      });
    } catch (error: any) {
      console.error("Error saving counter layout:", error);
      toast({
        title: "Failed to save layout",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const commonEmojis = ["📊", "📈", "📞", "🎯", "✅", "💰", "📝", "🔥", "⭐", "💪"];

  // Handle notification toggle
  const handleToggleNotifications = async (enabled: boolean) => {
    setIsSavingNotifications(true);
    try {
      if (enabled) {
        const success = await subscribe();
        if (success) {
          toast({
            title: "Notifications enabled",
            description: "You'll receive reminders to save your work after sunset.",
          });
        } else {
          toast({
            title: "Could not enable notifications",
            description: "Check your browser settings and try again.",
            variant: "destructive",
          });
        }
      } else {
        const success = await unsubscribe();
        if (success) {
          toast({
            title: "Notifications disabled",
            description: "You won't receive save reminders anymore.",
          });
        }
      }
    } catch (error: any) {
      console.error("Error toggling notifications:", error);
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Build ordered list combining core and custom counters
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

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Summer Season Dates - Collapsible */}
        <Card>
          <Collapsible open={isSummerDatesOpen} onOpenChange={setIsSummerDatesOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle>Summer Season Dates</CardTitle>
                    {!isSummerDatesOpen && (summerStart || summerEnd) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {summerStart ? format(summerStart, 'MMM d') : '—'} to {summerEnd ? format(summerEnd, 'MMM d, yyyy') : '—'}
                      </p>
                    )}
                  </div>
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isSummerDatesOpen && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal mt-1"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {summerStart ? format(summerStart, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={summerStart}
                          onSelect={setSummerStart}
                          disabled={(date) =>
                            date < new Date('2026-04-12') || 
                            date > new Date('2026-09-27') ||
                            (summerEnd && date > summerEnd)
                          }
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
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal mt-1"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {summerEnd ? format(summerEnd, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={summerEnd}
                          onSelect={setSummerEnd}
                          disabled={(date) =>
                            date < new Date('2026-04-12') || 
                            date > new Date('2026-09-27') ||
                            (summerStart && date < summerStart)
                          }
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <Button 
                  onClick={handleSaveSummerDates}
                  disabled={!summerStart || !summerEnd || isSavingSummer}
                  className="w-full"
                >
                  {isSavingSummer ? "Saving..." : "Save Summer Dates"}
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  These dates will be used for your personal goal calculations
                </p>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Preseason Commitments */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => window.location.href = '/goals'}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle>Preseason Commitments</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Training hours, books, blitzes & more
                </p>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground -rotate-90" />
            </div>
          </CardHeader>
        </Card>
        
        {/* EFP Mode (Vets only) - Collapsible */}
        {isVet && (
          <Card>
            <Collapsible open={isEfpModeOpen} onOpenChange={setIsEfpModeOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle>EFP Mode</CardTitle>
                      {!isEfpModeOpen && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {repData?.efp_mode_enabled ? "Enabled" : "Disabled"}
                        </p>
                      )}
                    </div>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isEfpModeOpen && "rotate-180")} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Enable EFP Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, Calendar and Insights will show EFP as your primary metric
                      </p>
                    </div>
                  <Switch
                    checked={repData?.efp_mode_enabled || false}
                    onCheckedChange={handleToggleEfpMode}
                    disabled={isSavingEfp}
                  />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Cancel/Unfunded Rate (Vets only) - Collapsible */}
        {isVet && (
          <Card>
            <Collapsible open={isCancelRateOpen} onOpenChange={setIsCancelRateOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-primary" />
                        Cancel/Unfunded Rate
                      </CardTitle>
                      {!isCancelRateOpen && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {cancelRate}% — Goals adjusted by {((1 / (1 - cancelRate / 100) - 1) * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isCancelRateOpen && "rotate-180")} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    This includes ROR cancels and unfunded accounts. Your goals will be adjusted to account for expected cancellations.
                  </p>
                  
                  {/* Stepper for cancel rate */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
                    <div>
                      <p className="font-semibold">Cancel Rate</p>
                      <p className="text-sm text-muted-foreground">
                        Sell {((1 / (1 - cancelRate / 100)) * 100).toFixed(0)}% of goal to hit target
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => {
                          const newRate = Math.max(5, cancelRate - 1);
                          setCancelRate(newRate);
                          handleSaveCancelRate(newRate);
                        }}
                        disabled={cancelRate <= 5 || isSavingCancelRate}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-xl font-bold w-12 text-center tabular-nums">
                        {cancelRate}%
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => {
                          const newRate = Math.min(15, cancelRate + 1);
                          setCancelRate(newRate);
                          handleSaveCancelRate(newRate);
                        }}
                        disabled={cancelRate >= 15 || isSavingCancelRate}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Example calculation */}
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs font-medium">Example</p>
                    <p className="text-sm text-muted-foreground">
                      If your goal is <span className="font-semibold text-foreground">100 FP+ funded</span>, 
                      you need to sell <span className="font-semibold text-foreground">{Math.round(100 / (1 - cancelRate / 100))} FP+</span> to 
                      end up with 100 funded after {cancelRate}% cancel.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Notifications - Collapsible */}
        {notificationsSupported && (
          <Card>
            <Collapsible open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Notifications
                      </CardTitle>
                      {!isNotificationsOpen && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {isSubscribed ? "Enabled" : permission === 'denied' ? "Blocked" : "Disabled"}
                        </p>
                      )}
                    </div>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isNotificationsOpen && "rotate-180")} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {permission === 'denied' ? (
                    <p className="text-sm text-muted-foreground">
                      Notifications are blocked by your browser. Enable them in your browser settings to receive save reminders.
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Save Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Get reminded to save your work if you've been idle after sunset
                        </p>
                      </div>
                      <Switch
                        checked={isSubscribed}
                        onCheckedChange={handleToggleNotifications}
                        disabled={isSavingNotifications || notificationsLoading}
                      />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {canAddCustomCounters && (
          <Card>
            <Collapsible open={isTrackCountersOpen} onOpenChange={setIsTrackCountersOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle>Track Counters</CardTitle>
                      {!isTrackCountersOpen && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {customCounters.length} custom counter{customCounters.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isTrackCountersOpen && "rotate-180")} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">All Counters</h3>
                      <span className="text-xs text-muted-foreground">Drag to reorder</span>
                    </div>
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
                          className={`group flex items-center gap-3 p-3 border rounded-lg bg-card border-border transition-opacity ${
                            draggedCounter === counter.id ? 'opacity-50' : ''
                          }`}
                        >
                          <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                          <span className="flex-1 font-medium flex items-center gap-2">
                            {counter.emoji && <span className="text-xl">{counter.emoji}</span>}
                            {counter.name}
                          </span>
                          {!counter.isCustom && (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">Core</span>
                          )}
                          {counter.isCustom && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const customId = counter.id.replace('custom_', '');
                                  handleToggleCounterVisibility(customId);
                                }}
                              >
                                {counter.hidden ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const customId = counter.id.replace('custom_', '');
                                  setDeleteConfirmCounter(customId);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <Button
                      onClick={handleSaveCounterLayout}
                      disabled={isSavingLayout}
                      size="sm"
                      className="w-full"
                    >
                      {isSavingLayout ? "Saving..." : "Save Counter Order"}
                    </Button>
                  </div>
                  
                  {/* Add Counter Button */}
                  <div className="pt-2 border-t border-border">
                    {canAddMore ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowAddSheet(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Custom Counter ({customCounters.length}/{maxCounters})
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">
                        Maximum of {maxCounters} custom counters reached
                      </p>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>

      {/* Add Custom Counter Drawer */}
      <Drawer open={showAddSheet} onOpenChange={setShowAddSheet}>
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>Add Custom Counter</DrawerTitle>
            <DrawerDescription>
              Create a custom counter to track additional metrics on the Track page.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 mt-6 px-4">
            <div>
              <Label htmlFor="counter-name">Counter Name</Label>
              <Input
                id="counter-name"
                placeholder="e.g., Referrals"
                value={counterName}
                onChange={(e) => setCounterName(e.target.value)}
                maxLength={20}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {counterName.length}/20 characters
              </p>
            </div>

            <div>
              <Label>Emoji (Optional)</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCounterEmoji(emoji)}
                    className={`p-3 text-2xl border rounded-lg transition-colors ${
                      counterEmoji === emoji
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {counterEmoji}
              </p>
            </div>

            <Button
              className="w-full py-6 text-lg font-semibold"
              onClick={handleAddCounter}
              disabled={!counterName.trim() || isSaving}
              size="lg"
            >
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
            <DrawerDescription>
              This will permanently delete this custom counter. This action cannot be undone.
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Button
              onClick={() => deleteConfirmCounter && handleDeleteCounter(deleteConfirmCounter)}
              variant="destructive"
              className="w-full py-6 text-lg font-semibold"
              size="lg"
            >
              Delete
            </Button>
            <Button
              onClick={() => setDeleteConfirmCounter(null)}
              variant="outline"
              className="w-full py-6 text-lg font-semibold"
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
