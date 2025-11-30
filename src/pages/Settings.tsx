import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Trash2, Plus, Info, Calendar as CalendarIcon, GripVertical, Eye, EyeOff } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface CustomCounter {
  id: string;
  name: string;
  emoji: string;
}

interface CounterLayoutConfig {
  order: string[];
  hidden: string[];
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
  
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [counterName, setCounterName] = useState("");
  const [counterEmoji, setCounterEmoji] = useState("📊");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Summer dates state
  const [summerStart, setSummerStart] = useState<Date>();
  const [summerEnd, setSummerEnd] = useState<Date>();
  const [isSavingSummer, setIsSavingSummer] = useState(false);
  
  // EFP mode state
  const [efpMode, setEfpMode] = useState(false);
  const [isSavingEfp, setIsSavingEfp] = useState(false);
  
  // Counter layout state
  const [counterLayout, setCounterLayout] = useState<CounterLayoutConfig>({
    order: DEFAULT_COUNTER_ORDER,
    hidden: []
  });
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [draggedCounter, setDraggedCounter] = useState<string | null>(null);

  const canAddCustomCounters = repData?.year === "Vet" || repData?.year === "Sophomore";
  const isVet = repData?.year === "Vet";
  const customCounters: CustomCounter[] = Array.isArray(repData?.custom_counter_config) 
    ? (repData.custom_counter_config as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
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
      
      // Load EFP mode from rep data
      setEfpMode(repData.efp_mode_enabled || false);
      
      // Load counter layout config
      if (repData.counter_layout_config) {
        setCounterLayout(repData.counter_layout_config as CounterLayoutConfig);
      }
    };
    
    loadUserData();
  }, [repData]);

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
      };

      const updatedCounters = [...customCounters, newCounter];

      const { error } = await supabase
        .from("reps")
        .update({ custom_counter_config: updatedCounters as any })
        .eq("id", repData?.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });

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
    setIsDeleting(counterId);

    try {
      const updatedCounters = customCounters.filter((c) => c.id !== counterId);

      const { error } = await supabase
        .from("reps")
        .update({ custom_counter_config: updatedCounters as any })
        .eq("id", repData?.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });

      toast({
        title: "Counter deleted",
        description: "The counter and its historical data have been removed",
      });
    } catch (error: any) {
      console.error("Error deleting counter:", error);
      toast({
        title: "Failed to delete counter",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
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
    setEfpMode(enabled);
    setIsSavingEfp(true);
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({ efp_mode_enabled: enabled })
        .eq('id', repData?.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      
      toast({
        title: enabled ? "EFP mode enabled" : "EFP mode disabled",
        description: enabled 
          ? "EFP will now be your primary metric in Calendar and Insights"
          : "FP+ will now be your primary metric",
      });
    } catch (error: any) {
      console.error("Error toggling EFP mode:", error);
      setEfpMode(!enabled); // Revert on error
      toast({
        title: "Failed to update EFP mode",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingEfp(false);
    }
  };
  
  const handleToggleCounterVisibility = (counterId: string) => {
    setCounterLayout(prev => {
      const isCurrentlyHidden = prev.hidden.includes(counterId);
      const newHidden = isCurrentlyHidden
        ? prev.hidden.filter(id => id !== counterId)
        : [...prev.hidden, counterId];
      
      // Ensure at least 4 counters are visible
      const visibleCount = prev.order.length - newHidden.length;
      if (visibleCount < 4 && !isCurrentlyHidden) {
        toast({
          title: "Minimum counters required",
          description: "You must keep at least 4 counters visible",
          variant: "destructive",
        });
        return prev;
      }
      
      return { ...prev, hidden: newHidden };
    });
  };
  
  const handleDragStart = (counterId: string) => {
    setDraggedCounter(counterId);
  };
  
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCounter || draggedCounter === targetId) return;
    
    setCounterLayout(prev => {
      const newOrder = [...prev.order];
      const draggedIndex = newOrder.indexOf(draggedCounter);
      const targetIndex = newOrder.indexOf(targetId);
      
      // Remove from old position
      newOrder.splice(draggedIndex, 1);
      // Insert at new position
      newOrder.splice(targetIndex, 0, draggedCounter);
      
      return { ...prev, order: newOrder };
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

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Summer Season Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Summer Season Dates</CardTitle>
            <CardDescription>
              Set your personal summer season dates between April 12, 2026 and September 27, 2026
            </CardDescription>
          </CardHeader>
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
        </Card>
        
        {/* Counter Layout (Vets/Sophomores only) */}
        {canAddCustomCounters && (
          <Card>
            <CardHeader>
              <CardTitle>Counter Layout</CardTitle>
              <CardDescription>
                Customize the order and visibility of counters on your Track page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {counterLayout.order.map((counterId) => {
                  const isHidden = counterLayout.hidden.includes(counterId);
                  const label = COUNTER_LABELS[counterId];
                  
                  return (
                    <div
                      key={counterId}
                      draggable
                      onDragStart={() => handleDragStart(counterId)}
                      onDragOver={(e) => handleDragOver(e, counterId)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                        draggedCounter === counterId ? 'opacity-50' : ''
                      } ${isHidden ? 'bg-muted/50 border-muted' : 'bg-card border-border'}`}
                    >
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                      <span className={`flex-1 font-medium ${isHidden ? 'text-muted-foreground line-through' : ''}`}>
                        {label}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleCounterVisibility(counterId)}
                        className="flex-shrink-0"
                      >
                        {isHidden ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
              
              <Button
                onClick={handleSaveCounterLayout}
                disabled={isSavingLayout}
                className="w-full"
              >
                {isSavingLayout ? "Saving..." : "Save Layout"}
              </Button>
              
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Drag counters to reorder them. Toggle the eye icon to hide/show counters. You must keep at least 4 counters visible.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* EFP Mode (Vets only) */}
        {isVet && (
          <Card>
            <CardHeader>
              <CardTitle>EFP Mode</CardTitle>
              <CardDescription>
                Track EFP (PRMR ÷ 85) as your primary metric instead of FP+
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable EFP Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, Calendar and Insights will show EFP as your primary metric
                  </p>
                </div>
                <Switch
                  checked={efpMode}
                  onCheckedChange={handleToggleEfpMode}
                  disabled={isSavingEfp}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {canAddCustomCounters ? (
          <Card>
            <CardHeader>
              <CardTitle>Custom Counters</CardTitle>
              <CardDescription>
                Track additional metrics beyond the core 6 counters. Custom counters appear on your Track page and in your personal Insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customCounters.length > 0 ? (
                <div className="space-y-2">
                  {customCounters.map((counter) => (
                    <div
                      key={counter.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{counter.emoji}</span>
                        <span className="font-medium">{counter.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCounter(counter.id)}
                        disabled={isDeleting === counter.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No custom counters yet</p>
                  <p className="text-sm mt-1">Add counters to track additional metrics</p>
                </div>
              )}

              {canAddMore ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddSheet(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Counter ({customCounters.length}/{maxCounters})
                </Button>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    You've reached the maximum of {maxCounters} custom counters. Delete one to add a new counter.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> Deleting a counter will remove all its historical data. This cannot be undone.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Custom Counters</CardTitle>
              <CardDescription>
                Available for Vets and Sophomores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Custom counters allow experienced reps to track additional metrics beyond the core 6 inputs. This feature will be available once you complete your rookie season.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Counter Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Add Custom Counter</SheetTitle>
            <SheetDescription>
              Create a new counter to track on your QTally page
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
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

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddSheet(false);
                  setCounterName("");
                  setCounterEmoji("📊");
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddCounter}
                disabled={!counterName.trim() || isSaving}
              >
                {isSaving ? "Adding..." : "Add Counter"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
