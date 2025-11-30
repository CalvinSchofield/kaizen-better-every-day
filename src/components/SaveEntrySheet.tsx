import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Trash2, Clock, ChevronDown, HelpCircle, Download, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { format, parseISO, differenceInMinutes } from "date-fns";

interface SaveEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  date: Date; // The date being edited
  onSave: (data: {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
    upgrade_prmr?: number | null;
    saveDate: string;
    work_start_time?: string;
    work_end_time?: string;
    custom_counters?: Record<string, number>;
  }) => Promise<void>;
  onDelete?: () => void;
  isSaving: boolean;
  customCounterConfig?: Array<{ id: string; name: string; emoji: string; hidden?: boolean }>;
  counterLayoutConfig?: { order: string[] };
}

export const SaveEntrySheet = ({
  open,
  onOpenChange,
  entry,
  date,
  onSave,
  onDelete,
  isSaving,
  customCounterConfig = [],
  counterLayoutConfig,
}: SaveEntrySheetProps) => {
  const { repData } = useRepData();
  const { totalFP } = usePreseasonFP();
  const navigate = useNavigate();
  const [openHelp, setOpenHelp] = useState<'fp' | 'prmr' | null>(null);
  const [doorsKnocked, setDoorsKnocked] = useState("");
  const [decisionMakers, setDecisionMakers] = useState("");
  const [pitches, setPitches] = useState("");
  const [transitions, setTransitions] = useState("");
  const [presentations, setPresentations] = useState("");
  const [closes, setCloses] = useState("");
  const [fpPlus, setFpPlus] = useState("");
  const [prmr, setPrmr] = useState("");
  const [newAccounts, setNewAccounts] = useState(0);
  const [customCounters, setCustomCounters] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);
  const [isDailyActivityOpen, setIsDailyActivityOpen] = useState(true);
  const [showDataQualityWarning, setShowDataQualityWarning] = useState(false);

  // Determine if user is a rookie with <10 FP+
  const isRookie = repData?.year === "Rookie";
  const showHelp = true; // TEMPORARY: Always show for testing. Change back to: isRookie && totalFP < 10

  // Auto-set newAccounts when fpPlus changes
  useEffect(() => {
    const fpValue = parseFloat(fpPlus);
    if (fpValue > 0) {
      setNewAccounts(Math.floor(fpValue));
    } else {
      setNewAccounts(0);
    }
  }, [fpPlus]);

  useEffect(() => {
    if (open && entry) {
      // Pre-fill with existing entry data if available, show empty for 0 values
      setDoorsKnocked(entry.doors_knocked && entry.doors_knocked > 0 ? entry.doors_knocked.toString() : "");
      setDecisionMakers(entry.decision_makers && entry.decision_makers > 0 ? entry.decision_makers.toString() : "");
      setPitches(entry.pitches && entry.pitches > 0 ? entry.pitches.toString() : "");
      setTransitions(entry.transitions && entry.transitions > 0 ? entry.transitions.toString() : "");
      setPresentations(entry.presentations && entry.presentations > 0 ? entry.presentations.toString() : "");
      setCloses(entry.closes && entry.closes > 0 ? entry.closes.toString() : "");
      setFpPlus(entry.fp_plus && entry.fp_plus > 0 ? entry.fp_plus.toString() : "");
      setPrmr(entry.prmr && entry.prmr > 0 ? entry.prmr.toString() : "");
      
      // Pre-fill custom counters
      const customCounterData: Record<string, string> = {};
      customCounterConfig.forEach(config => {
        const value = entry.custom_counters?.[config.id];
        customCounterData[config.id] = value && value > 0 ? value.toString() : "";
      });
      setCustomCounters(customCounterData);
      
      // Pre-fill time data
      if (entry.work_start_time) {
        const startDate = parseISO(entry.work_start_time);
        setStartTime(format(startDate, 'HH:mm'));
      } else {
        setStartTime("");
      }
      
      if (entry.work_end_time) {
        const endDate = parseISO(entry.work_end_time);
        setEndTime(format(endDate, 'HH:mm'));
      } else {
        setEndTime("");
      }
    }
  }, [open, entry, customCounterConfig]);

  const hasResultsWithoutActivity = () => {
    const hasFpOrPrmr = (parseFloat(fpPlus) || 0) > 0 || (parseFloat(prmr) || 0) > 0;
    const hasAnyActivity = 
      (parseInt(doorsKnocked) || 0) > 0 ||
      (parseInt(decisionMakers) || 0) > 0 ||
      (parseInt(pitches) || 0) > 0 ||
      (parseInt(transitions) || 0) > 0 ||
      (parseInt(presentations) || 0) > 0 ||
      (parseInt(closes) || 0) > 0;
    
    return hasFpOrPrmr && !hasAnyActivity;
  };

  const handleSave = () => {
    // Check for data quality issue first
    if (hasResultsWithoutActivity()) {
      setShowDataQualityWarning(true);
      return;
    }
    
    proceedWithSave();
  };

  const proceedWithSave = async () => {
    const saveDate = format(date, 'yyyy-MM-dd');
    
    // Auto-fill end time with current time if not set (only when saving)
    let finalEndTime = endTime;
    if (startTime && !endTime) {
      const now = new Date();
      finalEndTime = format(now, 'HH:mm');
      setEndTime(finalEndTime); // Update local state so user sees it
    }
    
    // Convert times to ISO strings if provided
    let workStartTime: string | undefined;
    let workEndTime: string | undefined;
    
    if (startTime) {
      const [hours, minutes] = startTime.split(':');
      const startDate = new Date(date);
      startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      workStartTime = startDate.toISOString();
    }
    
    if (finalEndTime) {
      const [hours, minutes] = finalEndTime.split(':');
      const endDate = new Date(date);
      endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      workEndTime = endDate.toISOString();
    }
    
    // Process custom counters
    const customCounterData: Record<string, number> = {};
    Object.keys(customCounters).forEach(id => {
      customCounterData[id] = parseInt(customCounters[id]) || 0;
    });
    
    // Calculate upgrade metrics
    const fpValue = parseFloat(fpPlus) || 0;
    const upgradeFP = fpValue - newAccounts;
    const upgradePrmr = upgradeFP > 0 ? upgradeFP * 85 : null;
    
    // Wait for save to complete before closing
    await onSave({
      doors_knocked: parseInt(doorsKnocked) || 0,
      decision_makers: parseInt(decisionMakers) || 0,
      pitches: parseInt(pitches) || 0,
      transitions: parseInt(transitions) || 0,
      presentations: parseInt(presentations) || 0,
      closes: parseInt(closes) || 0,
      fp_plus: fpValue,
      prmr: parseFloat(prmr) || 0,
      upgrade_prmr: upgradePrmr,
      saveDate,
      work_start_time: workStartTime,
      work_end_time: workEndTime,
      custom_counters: customCounterData,
    });
    
    // Only close after save completes and resets
    onOpenChange(false);
  };
  
  // Calculate total time worked based on current input values
  const calculateTotalTime = () => {
    // If neither time is set, check entry data
    if (!startTime && !endTime) {
      if (!entry?.work_start_time) return "Not started";
      
      const start = parseISO(entry.work_start_time);
      const end = entry.work_end_time ? parseISO(entry.work_end_time) : new Date();
      
      let totalMinutes = differenceInMinutes(end, start);
      
      // Subtract break time
      const breakPeriods = entry.break_periods || [];
      breakPeriods.forEach((bp: any) => {
        if (bp.start) {
          const breakStart = parseISO(bp.start);
          const breakEnd = bp.end ? parseISO(bp.end) : new Date();
          totalMinutes -= differenceInMinutes(breakEnd, breakStart);
        }
      });
      
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${mins}m`;
    }
    
    // Use current input values for live calculation
    if (!startTime) return "Set start time";
    if (!endTime) return "Set end time";
    
    // Parse input times and calculate difference
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startDate = new Date(date);
    startDate.setHours(startHours, startMinutes, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(endHours, endMinutes, 0, 0);
    
    let totalMinutes = differenceInMinutes(endDate, startDate);
    
    // Handle overnight shifts (end time before start time)
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60; // Add 24 hours
    }
    
    // Subtract break time if available from entry
    const breakPeriods = entry?.break_periods || [];
    breakPeriods.forEach((bp: any) => {
      if (bp.start) {
        const breakStart = parseISO(bp.start);
        const breakEnd = bp.end ? parseISO(bp.end) : new Date();
        totalMinutes -= differenceInMinutes(breakEnd, breakStart);
      }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="pb-safe">
          <DrawerHeader className="mb-6 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {entry?.is_finalized && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <DrawerTitle>{format(date, 'MMM d')}</DrawerTitle>
            </div>
          </DrawerHeader>

        <div className="space-y-4 mt-6">
          {/* Daily Activity Card - Collapsible */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <Collapsible open={isDailyActivityOpen} onOpenChange={(open) => {
                setIsDailyActivityOpen(open);
                if (open) setIsTimeTrackingOpen(false);
              }}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group mb-3">
                  <Label className="text-base cursor-pointer">Daily Activity</Label>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isDailyActivityOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      // Build counter definitions matching Track page order
                      const allCounters = [
                        { field: "doors_knocked", label: "Doors Knocked", value: doorsKnocked, setter: setDoorsKnocked },
                        { field: "decision_makers", label: "Decision Makers", value: decisionMakers, setter: setDecisionMakers },
                        { field: "pitches", label: "Pitches", value: pitches, setter: setPitches },
                        { field: "transitions", label: "Transitions", value: transitions, setter: setTransitions },
                        { field: "presentations", label: "Presentations", value: presentations, setter: setPresentations },
                        { field: "closes", label: "Closes", value: closes, setter: setCloses },
                      ];

                      // Apply custom layout if available (matching Track page)
                      let coreCounters = allCounters;
                      if (counterLayoutConfig?.order) {
                        coreCounters = counterLayoutConfig.order
                          .map(field => allCounters.find(c => c.field === field))
                          .filter((c): c is typeof allCounters[0] => c !== undefined);
                      }

                      return coreCounters.map((counter, idx) => (
                        <div key={counter.field} className="space-y-1.5">
                          <Label htmlFor={counter.field} className="text-sm">{counter.label}</Label>
                          <Input
                            id={counter.field}
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            step="1"
                            placeholder=""
                            value={counter.value}
                            onChange={(e) => counter.setter(e.target.value)}
                            enterKeyHint="next"
                          />
                        </div>
                      ));
                    })()}

                    {/* Custom counters (if any) */}
                    {customCounterConfig.filter(c => !c.hidden).map(config => (
                      <div key={config.id} className="space-y-1.5">
                        <Label htmlFor={`custom-${config.id}`} className="text-sm">
                          {config.emoji} {config.name}
                        </Label>
                        <Input
                          id={`custom-${config.id}`}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          step="1"
                          placeholder=""
                          value={customCounters[config.id] || ""}
                          onChange={(e) => setCustomCounters(prev => ({ ...prev, [config.id]: e.target.value }))}
                          enterKeyHint="next"
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Time Tracking Card - Collapsible */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <Collapsible open={isTimeTrackingOpen} onOpenChange={(open) => {
                setIsTimeTrackingOpen(open);
                if (open) setIsDailyActivityOpen(false);
              }}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group mb-3">
                  <Label className="text-base cursor-pointer">Time Tracking</Label>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isTimeTrackingOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        id="start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-9"
                      />
                      <span className="text-sm text-muted-foreground">-</span>
                      <Input
                        id="end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/30 rounded-md">
                      <span className="text-xs text-muted-foreground">Total:</span>
                      <span className="text-xs font-medium">{calculateTotalTime()}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <Label className="text-base mb-3 block">Results</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fp-plus" className="text-sm">FP+</Label>
                    {showHelp && (
                      <button
                        type="button"
                        className="flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenHelp(openHelp === 'fp' ? null : 'fp');
                        }}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="fp-plus"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      placeholder=""
                      value={fpPlus}
                      onChange={(e) => setFpPlus(e.target.value)}
                      enterKeyHint="next"
                      className="flex-1"
                    />
                    {parseFloat(fpPlus) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const maxFP = Math.floor(parseFloat(fpPlus));
                          // Cycle: decrement until 0, then loop back to max
                          setNewAccounts(newAccounts === 0 ? maxFP : newAccounts - 1);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 h-10 rounded-md bg-muted/50 border border-border text-sm font-medium transition-all hover:bg-muted active:scale-95 animate-in fade-in slide-in-from-right-2 duration-200"
                      >
                        <span>{newAccounts} FP</span>
                      </button>
                    )}
                  </div>
                  {showHelp && openHelp === 'fp' && (
                    <div className="mt-2 p-2.5 bg-background border border-border rounded-lg flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground flex-1">
                        FP+ = Families Protected + Upgrades (upgrade PRMR ÷ 85)
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 shrink-0"
                        onClick={() => window.open('https://chatgpt.com/g/g-67f0056351a081918e8849fb6310fa42-vivintgpt', '_blank')}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Ask GPT
                      </Button>
                    </div>
                  )}
                  {/* Upgrade indicator */}
                  {(() => {
                    const fpValue = parseFloat(fpPlus) || 0;
                    const upgradeFP = fpValue - newAccounts;
                    const upgradePrmr = upgradeFP > 0 ? Math.round(upgradeFP * 85) : 0;
                    
                    if (upgradeFP > 0) {
                      return (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          📊 Includes {upgradeFP.toFixed(1)} upgrade FP+ (${upgradePrmr})
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="prmr" className="text-sm">PRMR</Label>
                    {showHelp && (
                      <button
                        type="button"
                        className="flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenHelp(openHelp === 'prmr' ? null : 'prmr');
                        }}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="prmr"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder=""
                      value={prmr}
                      onChange={(e) => setPrmr(e.target.value)}
                      className="pl-7"
                      enterKeyHint="done"
                    />
                  </div>
                  {showHelp && openHelp === 'prmr' && (
                    <div className="mt-2 p-2.5 bg-background border border-border rounded-lg flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground flex-1">
                        What the customer pays monthly (plus adders/deductions)
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => window.open('https://chatgpt.com/g/g-67f0056351a081918e8849fb6310fa42-vivintgpt', '_blank')}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          Ask
                        </Button>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                          title="Download pay scale"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = '/documents/2025_Sales_Rep_Payscale-2.pdf';
                            link.download = '2025_Sales_Rep_Payscale.pdf';
                            link.click();
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="text-xs">Payscale</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-6 text-lg"
            size="lg"
          >
            {isSaving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>

    <Drawer open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-6">
          <DrawerTitle>Delete Entry?</DrawerTitle>
          <DrawerDescription>
            This will permanently delete this entry. This action cannot be undone.
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={() => {
              onDelete?.();
              setShowDeleteDialog(false);
              onOpenChange(false);
            }}
            variant="destructive"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Delete Entry
          </Button>
          <Button
            onClick={() => setShowDeleteDialog(false)}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </DrawerContent>
    </Drawer>

    <Drawer open={showDataQualityWarning} onOpenChange={setShowDataQualityWarning}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-6">
          <DrawerTitle>Track While You Work 📊</DrawerTitle>
          <DrawerDescription>
            You've entered results but no daily activity. For the most accurate 
            insights and data, track your numbers on the app while working next time!
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 text-sm text-muted-foreground mb-6">
          Tracking in real-time helps you see your true ratios (doors per sale, 
          pitches per close) and understand what it takes to succeed.
        </div>
        
        <div className="flex flex-col gap-3 mt-6 px-4">
          <Button
            onClick={() => {
              setShowDataQualityWarning(false);
            }}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Add Activity Numbers
          </Button>
          <Button
            onClick={() => {
              setShowDataQualityWarning(false);
              proceedWithSave();
            }}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Save Results Only
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
};