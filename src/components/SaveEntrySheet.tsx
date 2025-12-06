import { useState, useEffect, useRef, useMemo } from "react";
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
import { Info, Trash2, Clock, ChevronDown, HelpCircle, Download, MessageSquare, AlertTriangle, Ban } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Sale } from "@/hooks/useDailyEntry";
import { ScheduledInstallStep } from "@/components/ScheduledInstallStep";
import { SaleDetailSheet } from "@/components/SaleDetailSheet";
import { useSaleUpdate } from "@/hooks/useSaleUpdate";

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
  salesLog?: Sale[];
}

type OpenCardType = 'activity' | 'time' | 'results' | null;

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
  salesLog = [],
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
  const [openCard, setOpenCard] = useState<OpenCardType>(null);
  const [showDataQualityWarning, setShowDataQualityWarning] = useState(false);
  const [showHighValueWarning, setShowHighValueWarning] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);
  const [acknowledgedEarlyEnd, setAcknowledgedEarlyEnd] = useState(false);
  const [startTimeWarning, setStartTimeWarning] = useState<string | null>(null);
  const [endTimeWarning, setEndTimeWarning] = useState<string | null>(null);
  const [showInstallStep, setShowInstallStep] = useState(false);
  const [pendingSalesWithInstallTracking, setPendingSalesWithInstallTracking] = useState<Sale[] | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleDetail, setShowSaleDetail] = useState(false);
  const isSavingRef = useRef(false);
  
  // Sale update hook
  const { updateSale } = useSaleUpdate();

  // Calculate timestamp bounds from counter_timestamps
  const timestampBounds = useMemo(() => {
    const counterTimestamps = entry?.counter_timestamps;
    if (!counterTimestamps) return { earliest: null, latest: null, earliestTime: '', latestTime: '' };
    
    let earliest: Date | null = null;
    let latest: Date | null = null;
    
    Object.values(counterTimestamps).forEach((timestamps: any) => {
      if (Array.isArray(timestamps)) {
        timestamps.forEach((ts: string) => {
          const date = new Date(ts);
          if (!earliest || date < earliest) earliest = date;
          if (!latest || date > latest) latest = date;
        });
      }
    });
    
    const userTimezone = entry?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const earliestTime = earliest ? earliest.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: userTimezone 
    }) : '';
    const latestTime = latest ? latest.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: userTimezone 
    }) : '';
    
    return { earliest, latest, earliestTime, latestTime };
  }, [entry?.counter_timestamps, entry?.timezone]);

  // Validate start time against earliest timestamp
  const validateStartTime = (time: string) => {
    if (!time || !timestampBounds.earliest) {
      setStartTimeWarning(null);
      return;
    }
    
    const [hours, minutes] = time.split(':').map(Number);
    const inputDate = new Date(date);
    inputDate.setHours(hours, minutes, 0, 0);
    
    if (inputDate > timestampBounds.earliest) {
      setStartTimeWarning(`First tracked activity was at ${timestampBounds.earliestTime}`);
    } else {
      setStartTimeWarning(null);
    }
  };

  // Validate end time against latest timestamp
  const validateEndTime = (time: string) => {
    if (!time || !timestampBounds.latest) {
      setEndTimeWarning(null);
      return;
    }
    
    const [hours, minutes] = time.split(':').map(Number);
    const inputDate = new Date(date);
    inputDate.setHours(hours, minutes, 0, 0);
    
    if (inputDate < timestampBounds.latest) {
      setEndTimeWarning(`Last tracked activity was at ${timestampBounds.latestTime}`);
    } else {
      setEndTimeWarning(null);
    }
  };

  // Handle start time change with validation
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    validateStartTime(value);
  };

  // Handle end time change with validation
  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    validateEndTime(value);
    // Reset acknowledgment when end time changes
    if (acknowledgedEarlyEnd) setAcknowledgedEarlyEnd(false);
  };

  // Determine if user is a rookie with <10 FP+
  const isRookie = repData?.year === "Rookie";
  const isVet = repData?.year === "Vet" || repData?.year === "Sophomore";
  const showHelp = true; // TEMPORARY: Always show for testing. Change back to: isRookie && totalFP < 10

  // Auto-set newAccounts when fpPlus changes - but only if form hasn't been initialized with existing data
  // This prevents overwriting the calculated newAccounts from saved upgrade_prmr
  const hasInitializedNewAccounts = useRef(false);
  
  useEffect(() => {
    // Skip auto-calculation if we already initialized from saved data
    if (hasInitializedNewAccounts.current) return;
    
    const fpValue = parseFloat(fpPlus);
    if (fpValue > 0) {
      setNewAccounts(Math.floor(fpValue));
    } else {
      setNewAccounts(0);
    }
  }, [fpPlus]);

  // Track if form has been initialized to prevent repopulation during typing
  const formInitializedRef = useRef(false);
  
  // Check if sections have data for summary display
  const hasActivityData = useMemo(() => {
    return (parseInt(doorsKnocked) || 0) > 0 ||
           (parseInt(decisionMakers) || 0) > 0 ||
           (parseInt(pitches) || 0) > 0 ||
           (parseInt(transitions) || 0) > 0 ||
           (parseInt(presentations) || 0) > 0 ||
           (parseInt(closes) || 0) > 0;
  }, [doorsKnocked, decisionMakers, pitches, transitions, presentations, closes]);

  const hasTimeData = useMemo(() => {
    return startTime !== "" || endTime !== "";
  }, [startTime, endTime]);

  const hasResultsData = useMemo(() => {
    return (parseFloat(fpPlus) || 0) > 0 || (parseFloat(prmr) || 0) > 0;
  }, [fpPlus, prmr]);

  // Build activity summary text
  const activitySummary = useMemo(() => {
    const parts: string[] = [];
    if ((parseInt(doorsKnocked) || 0) > 0) parts.push(`${doorsKnocked} doors`);
    if ((parseInt(presentations) || 0) > 0) parts.push(`${presentations} pres`);
    if ((parseInt(closes) || 0) > 0) parts.push(`${closes} closes`);
    if (parts.length === 0) {
      // Try other metrics
      if ((parseInt(pitches) || 0) > 0) parts.push(`${pitches} pitches`);
      if ((parseInt(transitions) || 0) > 0) parts.push(`${transitions} trans`);
    }
    return parts.slice(0, 3).join(' · ') || 'No activity';
  }, [doorsKnocked, pitches, transitions, presentations, closes]);

  // Build time summary text
  const timeSummary = useMemo(() => {
    if (!startTime && !endTime) return 'No time logged';
    if (startTime && endTime) {
      return `${startTime} - ${endTime}`;
    }
    if (startTime) return `Started ${startTime}`;
    return 'No time logged';
  }, [startTime, endTime]);

  // Build results summary text
  const resultsSummary = useMemo(() => {
    const parts: string[] = [];
    const fp = parseFloat(fpPlus) || 0;
    const prmrVal = parseFloat(prmr) || 0;
    if (fp > 0) parts.push(`${fp} FP+`);
    if (prmrVal > 0) parts.push(`$${Math.round(prmrVal)}`);
    return parts.join(' · ') || 'No results';
  }, [fpPlus, prmr]);

  useEffect(() => {
    // Only populate form when sheet first opens, not on every entry change
    if (open && !isSavingRef.current && !formInitializedRef.current) {
      // Small delay to ensure entry data is available
      const initializeForm = () => {
        if (entry) {
          // Pre-fill with existing entry data if available, show empty for 0 values
          setDoorsKnocked(entry.doors_knocked && entry.doors_knocked > 0 ? entry.doors_knocked.toString() : "");
          setDecisionMakers(entry.decision_makers && entry.decision_makers > 0 ? entry.decision_makers.toString() : "");
          setPitches(entry.pitches && entry.pitches > 0 ? entry.pitches.toString() : "");
          setTransitions(entry.transitions && entry.transitions > 0 ? entry.transitions.toString() : "");
          setPresentations(entry.presentations && entry.presentations > 0 ? entry.presentations.toString() : "");
          setCloses(entry.closes && entry.closes > 0 ? entry.closes.toString() : "");
          
          // AUTO-CALCULATE from sales log if available
          if (salesLog && salesLog.length > 0) {
            const fpSales = salesLog.filter(s => s.type === 'fp');
            const upgradeSales = salesLog.filter(s => s.type === 'upgrade');
            const fpCount = fpSales.length;
            const fpPrmrTotal = fpSales.reduce((sum, s) => sum + s.prmr, 0);
            const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + s.prmr, 0);
            const totalPrmr = fpPrmrTotal + upgradePrmrTotal; // Total PRMR from all sales
            const calculatedFpPlus = fpCount + (upgradePrmrTotal / 85);
            
            setFpPlus(calculatedFpPlus > 0 ? calculatedFpPlus.toFixed(2) : "");
            setPrmr(totalPrmr > 0 ? totalPrmr.toFixed(2) : ""); // Total PRMR (FP + upgrades)
            setNewAccounts(fpCount);
            hasInitializedNewAccounts.current = true;
          } else {
            setFpPlus(entry.fp_plus && entry.fp_plus > 0 ? entry.fp_plus.toString() : "");
            setPrmr(entry.prmr && entry.prmr > 0 ? entry.prmr.toString() : "");
            
            // Calculate newAccounts from saved data to preserve original split
            const fpValue = entry.fp_plus || 0;
            const upgradePrmr = entry.upgrade_prmr || 0;
            const upgradeFP = upgradePrmr / 85;
            const calculatedNewAccounts = Math.round(fpValue - upgradeFP);
            setNewAccounts(Math.max(0, calculatedNewAccounts));
            hasInitializedNewAccounts.current = true;
          }
          
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

          // Determine which card to open based on data availability
          // If existing entry has data, keep all collapsed
          // If no data anywhere, open activity card for new entry
          const hasAnyActivity = (entry.doors_knocked || 0) > 0 || 
                                 (entry.decision_makers || 0) > 0 ||
                                 (entry.pitches || 0) > 0 ||
                                 (entry.transitions || 0) > 0 ||
                                 (entry.presentations || 0) > 0 ||
                                 (entry.closes || 0) > 0;
          const hasAnyTime = entry.work_start_time || entry.work_end_time;
          const hasAnyResults = (entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0;
          
          if (!hasAnyActivity && !hasAnyTime && !hasAnyResults) {
            // New empty entry - open activity card
            setOpenCard('activity');
          } else {
            // Has existing data - keep all collapsed
            setOpenCard(null);
          }
        } else {
          // No entry - new day, open activity card
          setDoorsKnocked("");
          setDecisionMakers("");
          setPitches("");
          setTransitions("");
          setPresentations("");
          setCloses("");
          setFpPlus("");
          setPrmr("");
          setNewAccounts(0);
          setCustomCounters({});
          setStartTime("");
          setEndTime("");
          setOpenCard('activity');
        }
        
        formInitializedRef.current = true;
        setIsFormReady(true);
      };

      // Use requestAnimationFrame to ensure entry data is settled
      requestAnimationFrame(() => {
        initializeForm();
      });
    }
    
    // Reset flags when sheet closes
    if (!open) {
      isSavingRef.current = false;
      formInitializedRef.current = false;
      hasInitializedNewAccounts.current = false;
      setIsFormReady(false);
      setOpenCard(null);
      setStartTimeWarning(null);
      setEndTimeWarning(null);
      setAcknowledgedEarlyEnd(false);
      setShowInstallStep(false);
      setPendingSalesWithInstallTracking(null);
    }
  }, [open, entry?.id]); // Only depend on open state and entry ID, not entire entry object

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

  const hasUnusuallyHighValues = () => {
    const fpValue = parseFloat(fpPlus) || 0;
    const prmrValue = parseFloat(prmr) || 0;
    
    if (isRookie) {
      return fpValue > 4 || prmrValue > 425;
    } else if (isVet) {
      return fpValue > 7 || prmrValue > 850;
    }
    
    return false;
  };

  const handleSave = () => {
    // Check if entry is already finalized (prevent accidental overwrite)
    if (entry?.is_finalized) {
      setShowOverwriteWarning(true);
      return;
    }
    
    // Check for unacknowledged end time warning
    if (endTimeWarning && !acknowledgedEarlyEnd) {
      // Open time card to show the warning
      setOpenCard('time');
      return;
    }
    
    // Check for data quality issue first
    if (hasResultsWithoutActivity()) {
      setShowDataQualityWarning(true);
      return;
    }
    
    // Check for unusually high values
    if (hasUnusuallyHighValues()) {
      setShowHighValueWarning(true);
      return;
    }
    
    // If there are sales logged, show install confirmation step
    if (salesLog && salesLog.length > 0) {
      // Check if any sales don't have install tracking yet (new sales being saved)
      const hasUnmarkedSales = salesLog.some(s => s.install_status === undefined);
      if (hasUnmarkedSales) {
        setShowInstallStep(true);
        return;
      }
    }
    
    proceedWithSave();
  };

  // Handle install step confirmation
  const handleInstallConfirm = (updatedSales: Sale[]) => {
    setPendingSalesWithInstallTracking(updatedSales);
    setShowInstallStep(false);
    // Continue with save using updated sales
    proceedWithSaveWithSales(updatedSales);
  };

  const proceedWithSave = async () => {
    // If we have pending sales with install tracking, use those
    const salesToUse = pendingSalesWithInstallTracking || salesLog;
    await proceedWithSaveWithSales(salesToUse);
  };

  const proceedWithSaveWithSales = async (salesToSave: Sale[] | undefined) => {
    // Set flag to prevent useEffect from repopulating form during save/close
    isSavingRef.current = true;
    
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

  const handleCardToggle = (card: OpenCardType) => {
    setOpenCard(openCard === card ? null : card);
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
              <Collapsible open={openCard === 'activity'} onOpenChange={() => handleCardToggle('activity')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Label className="text-base cursor-pointer">Daily Activity</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {openCard !== 'activity' && (
                      <span className="text-sm text-muted-foreground">{activitySummary}</span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openCard === 'activity' ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-3 mt-3">
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
              <Collapsible open={openCard === 'time'} onOpenChange={() => handleCardToggle('time')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Label className="text-base cursor-pointer">Time Tracking</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {openCard !== 'time' && (
                      <span className="text-sm text-muted-foreground">{timeSummary}</span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openCard === 'time' ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-3">
                    {/* Timestamp bounds display */}
                    {timestampBounds.earliest && timestampBounds.latest ? (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/30 rounded-md text-xs">
                        <span className="text-muted-foreground">Activity:</span>
                        <span className="font-medium">{timestampBounds.earliestTime}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{timestampBounds.latestTime}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/20 rounded-md text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5" />
                        <span>No real-time tracking data</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        id="start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        className={`flex-1 h-10 text-center ${startTimeWarning ? 'border-amber-500' : ''}`}
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        id="end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className={`flex-1 h-10 text-center ${endTimeWarning && !acknowledgedEarlyEnd ? 'border-amber-500' : ''}`}
                      />
                    </div>
                    
                    {/* Time warnings */}
                    {(startTimeWarning || endTimeWarning) && (
                      <div className="space-y-1.5">
                        {startTimeWarning && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {startTimeWarning}
                          </p>
                        )}
                        {endTimeWarning && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {endTimeWarning}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Acknowledgment checkbox for early end time */}
                    {endTimeWarning && (
                      <div className="flex items-center gap-2 px-2 py-2 bg-amber-500/10 rounded-md border border-amber-500/20">
                        <Checkbox
                          id="acknowledge-early-end"
                          checked={acknowledgedEarlyEnd}
                          onCheckedChange={(checked) => setAcknowledgedEarlyEnd(checked === true)}
                        />
                        <label htmlFor="acknowledge-early-end" className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                          I finished earlier than my last tracked activity
                        </label>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/30 rounded-md">
                      <span className="text-xs text-muted-foreground">Total:</span>
                      <span className="text-xs font-medium">{calculateTotalTime()}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Results Card - Now Collapsible */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <Collapsible open={openCard === 'results'} onOpenChange={() => handleCardToggle('results')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Label className="text-base cursor-pointer">Results</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {openCard !== 'results' && (
                      <span className="text-sm text-muted-foreground">{resultsSummary}</span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openCard === 'results' ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-3">
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
                        <Label htmlFor="prmr" className="text-sm">Total PRMR</Label>
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
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Logged Sales Section */}
          {salesLog && salesLog.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <Label className="text-base mb-3 block">Logged Sales</Label>
                <div className="flex flex-wrap gap-2">
                  {salesLog.map((sale) => {
                    const isCancelled = sale.install_status === 'cancelled';
                    const isPending = sale.install_status === 'pending';
                    const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
                    
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowSaleDetail(true);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                          isCancelled 
                            ? 'bg-destructive/10 text-destructive line-through' 
                            : isPending
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                              : sale.type === 'fp'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                        }`}
                      >
                        {isCancelled && <Ban className="h-3 w-3" />}
                        <span className="uppercase text-xs font-bold">
                          {sale.type === 'fp' ? 'FP' : 'UP'}
                        </span>
                        <span>${sale.prmr}</span>
                        <span className="text-xs opacity-70">{timeStr}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tap a sale to edit PRMR or mark as cancelled
                </p>
              </CardContent>
            </Card>
          )}

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

    {/* Sale Detail Sheet */}
    <SaleDetailSheet
      open={showSaleDetail}
      onOpenChange={setShowSaleDetail}
      sale={selectedSale}
      entryDate={format(date, 'yyyy-MM-dd')}
      onUpdateSale={async (updatedSale) => {
        if (entry?.id) {
          await updateSale({
            entryId: entry.id,
            entryDate: format(date, 'yyyy-MM-dd'),
            saleId: updatedSale.id,
            updates: updatedSale,
          });
        }
        setShowSaleDetail(false);
        setSelectedSale(null);
      }}
    />

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

    <Drawer open={showHighValueWarning} onOpenChange={setShowHighValueWarning}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-6">
          <DrawerTitle>Double-Check Your Numbers 🤔</DrawerTitle>
          <DrawerDescription>
            {isRookie 
              ? `You entered ${fpPlus || '0'} FP+ and $${prmr || '0'} PRMR. That's higher than usual for most rookies (4 FP+ / $425 PRMR). Just want to make sure these numbers are correct!`
              : `You entered ${fpPlus || '0'} FP+ and $${prmr || '0'} PRMR. That's higher than usual (7 FP+ / $850 PRMR). Just want to make sure these numbers are correct!`
            }
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 text-sm text-muted-foreground mb-6">
          If these numbers are right, great work! If not, go back and adjust them.
        </div>
        
        <div className="flex flex-col gap-3 mt-6 px-4">
          <Button
            onClick={() => {
              setShowHighValueWarning(false);
            }}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Edit Numbers
          </Button>
          <Button
            onClick={() => {
              setShowHighValueWarning(false);
              proceedWithSave();
            }}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Yes, Numbers Are Correct
          </Button>
        </div>
      </DrawerContent>
    </Drawer>

    <Drawer open={showOverwriteWarning} onOpenChange={setShowOverwriteWarning}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-6">
          <DrawerTitle>Already Saved ⚠️</DrawerTitle>
          <DrawerDescription>
            This day's entry has already been saved. Saving again will overwrite your existing data.
            Are you sure you want to continue?
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 text-sm text-muted-foreground mb-6">
          If you need to make changes, your existing data will be replaced with the current values shown.
        </div>
        
        <div className="flex flex-col gap-3 mt-6 px-4">
          <Button
            onClick={() => {
              setShowOverwriteWarning(false);
            }}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Keep Existing Data
          </Button>
          <Button
            onClick={() => {
              setShowOverwriteWarning(false);
              // Skip other validations since they already saved once
              proceedWithSave();
            }}
            variant="outline"
            className="w-full py-6 text-lg font-semibold text-destructive"
            size="lg"
          >
            Overwrite Data
          </Button>
        </div>
      </DrawerContent>
    </Drawer>

    {/* Scheduled Install Step */}
    <ScheduledInstallStep
      open={showInstallStep}
      onOpenChange={setShowInstallStep}
      salesLog={salesLog || []}
      onConfirm={handleInstallConfirm}
    />
    </>
  );
};
