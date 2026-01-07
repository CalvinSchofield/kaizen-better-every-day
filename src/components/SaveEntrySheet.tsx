import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { Info, Trash2, Clock, ChevronDown, AlertTriangle, Ban, Plus, Check, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Sale } from "@/hooks/useDailyEntry";
import { ScheduledInstallStep } from "@/components/ScheduledInstallStep";
import { SaleDetailSheet } from "@/components/SaleDetailSheet";
import { useSaleUpdate } from "@/hooks/useSaleUpdate";
import { LogSaleSheet } from "@/components/LogSaleSheet";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";

interface SaveEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  date: Date;
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
    sales_log?: Sale[];
  }) => Promise<void>;
  onDelete?: () => void;
  isSaving: boolean;
  customCounterConfig?: Array<{ id: string; name: string; emoji: string; hidden?: boolean }>;
  counterLayoutConfig?: { order: string[] };
  salesLog?: Sale[];
  skipSummaryView?: boolean; // Skip summary and go directly to save (with install step if needed)
}

type OpenCardType = 'activity' | 'time' | null;

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
  skipSummaryView = false,
}: SaveEntrySheetProps) => {
  const { repData } = useRepData();
  const { totalFP } = usePreseasonFP();
  
  // Activity counters
  const [doorsKnocked, setDoorsKnocked] = useState("");
  const [decisionMakers, setDecisionMakers] = useState("");
  const [pitches, setPitches] = useState("");
  const [transitions, setTransitions] = useState("");
  const [presentations, setPresentations] = useState("");
  const [closes, setCloses] = useState("");
  const [customCounters, setCustomCounters] = useState<Record<string, string>>({});
  
  // Time tracking
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startTimeWarning, setStartTimeWarning] = useState<string | null>(null);
  const [endTimeWarning, setEndTimeWarning] = useState<string | null>(null);
  const [acknowledgedEarlyEnd, setAcknowledgedEarlyEnd] = useState(false);
  
  // UI state
  const [openCard, setOpenCard] = useState<OpenCardType>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDataQualityWarning, setShowDataQualityWarning] = useState(false);
  const [showHighValueWarning, setShowHighValueWarning] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);
  
  // Sales management - local sales for adding new sales
  const [localSales, setLocalSales] = useState<Sale[]>([]);
  const [showLogSaleSheet, setShowLogSaleSheet] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleDetail, setShowSaleDetail] = useState(false);
  
  // Install tracking
  const [showInstallStep, setShowInstallStep] = useState(false);
  const [pendingSalesWithInstallTracking, setPendingSalesWithInstallTracking] = useState<Sale[] | null>(null);
  
  const isSavingRef = useRef(false);
  const formInitializedRef = useRef(false);
  
  // Sale update hook (for editing existing salesLog entries)
  const { updateSale, deleteSale } = useSaleUpdate();

  // Detect legacy data: entry has FP+/PRMR but no sales_log
  const hasLegacyData = useMemo(() => {
    const hasFpOrPrmr = (entry?.fp_plus && entry.fp_plus > 0) || (entry?.prmr && entry.prmr > 0);
    const noSalesLog = !salesLog || salesLog.length === 0;
    const noLocalSales = localSales.length === 0;
    return hasFpOrPrmr && noSalesLog && noLocalSales;
  }, [entry?.fp_plus, entry?.prmr, salesLog, localSales]);

  // Generate suggested sales from legacy FP+/PRMR data
  const suggestedSales = useMemo((): Sale[] => {
    if (!hasLegacyData || !entry) return [];
    
    const fpPlus = entry.fp_plus || 0;
    const totalPrmr = entry.prmr || 0;
    const upgradePrmr = entry.upgrade_prmr || 0;
    
    const suggestions: Sale[] = [];
    const baseTimestamp = entry.work_start_time || new Date().toISOString();
    
    // Calculate FP count from fp_plus (whole number part)
    const fpCount = Math.floor(fpPlus);
    
    // Calculate upgrade PRMR from decimal part of fp_plus
    // If upgrade_prmr is stored, use that; otherwise derive from fp_plus decimal
    const derivedUpgradePrmr = upgradePrmr > 0 ? upgradePrmr : Math.round((fpPlus % 1) * 85);
    
    // FP PRMR is total minus upgrade
    const fpPrmr = totalPrmr - derivedUpgradePrmr;
    
    // Create FP sales
    if (fpCount > 0) {
      const prmrPerFp = Math.round(fpPrmr / fpCount);
      for (let i = 0; i < fpCount; i++) {
        suggestions.push({
          id: `suggested-fp-${i}`,
          type: 'fp',
          prmr: prmrPerFp,
          timestamp: baseTimestamp,
        });
      }
    }
    
    // Create upgrade sale if there's upgrade PRMR
    if (derivedUpgradePrmr > 0) {
      suggestions.push({
        id: 'suggested-upgrade-0',
        type: 'upgrade',
        prmr: derivedUpgradePrmr,
        timestamp: baseTimestamp,
      });
    }
    
    return suggestions;
  }, [hasLegacyData, entry]);

  // Track if user has confirmed/dismissed suggested sales
  const [suggestedSalesConfirmed, setSuggestedSalesConfirmed] = useState(false);

  // Combine salesLog (from DB) with localSales (newly added)
  const allSales = useMemo(() => {
    // Combine existing sales from DB with newly added local sales
    return [...salesLog, ...localSales];
  }, [salesLog, localSales]);

  // Calculate FP+ and PRMR from sales
  const calculatedMetrics = useMemo(() => {
    const fundedSales = allSales.filter(s => s.install_status !== 'cancelled');
    const fpSales = fundedSales.filter(s => s.type === 'fp');
    const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
    
    const fpCount = fpSales.length;
    const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
    const fpPlus = fpCount + (upgradePrmrTotal / 85);
    
    return { fpPlus, totalPrmr, upgradePrmrTotal, fpCount };
  }, [allSales]);

  // Determine if user is a rookie
  const isRookie = repData?.year === "Rookie";
  const isVet = repData?.year === "Vet" || repData?.year === "Sophomore";
  const showPrmrHelper = isRookie || totalFP < 20;

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

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    validateStartTime(value);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    validateEndTime(value);
    if (acknowledgedEarlyEnd) setAcknowledgedEarlyEnd(false);
  };

  // Build summary texts
  const activitySummary = useMemo(() => {
    const parts: string[] = [];
    if ((parseInt(doorsKnocked) || 0) > 0) parts.push(`${doorsKnocked} doors`);
    if ((parseInt(presentations) || 0) > 0) parts.push(`${presentations} pres`);
    if ((parseInt(closes) || 0) > 0) parts.push(`${closes} closes`);
    if (parts.length === 0) {
      if ((parseInt(pitches) || 0) > 0) parts.push(`${pitches} pitches`);
      if ((parseInt(transitions) || 0) > 0) parts.push(`${transitions} trans`);
    }
    return parts.slice(0, 3).join(' · ') || 'No activity';
  }, [doorsKnocked, pitches, transitions, presentations, closes]);

  const timeSummary = useMemo(() => {
    if (!startTime && !endTime) return 'No time logged';
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    if (startTime) return `Started ${startTime}`;
    return 'No time logged';
  }, [startTime, endTime]);

  // Initialize form when sheet opens
  useEffect(() => {
    if (open && !isSavingRef.current && !formInitializedRef.current) {
      const initializeForm = () => {
        if (entry) {
          setDoorsKnocked(entry.doors_knocked && entry.doors_knocked > 0 ? entry.doors_knocked.toString() : "");
          setDecisionMakers(entry.decision_makers && entry.decision_makers > 0 ? entry.decision_makers.toString() : "");
          setPitches(entry.pitches && entry.pitches > 0 ? entry.pitches.toString() : "");
          setTransitions(entry.transitions && entry.transitions > 0 ? entry.transitions.toString() : "");
          setPresentations(entry.presentations && entry.presentations > 0 ? entry.presentations.toString() : "");
          setCloses(entry.closes && entry.closes > 0 ? entry.closes.toString() : "");
          
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

          // Determine which card to open
          const hasAnyActivity = (entry.doors_knocked || 0) > 0 || 
                                 (entry.decision_makers || 0) > 0 ||
                                 (entry.pitches || 0) > 0 ||
                                 (entry.transitions || 0) > 0 ||
                                 (entry.presentations || 0) > 0 ||
                                 (entry.closes || 0) > 0;
          const hasAnyTime = entry.work_start_time || entry.work_end_time;
          const hasAnySales = salesLog && salesLog.length > 0;
          
          if (!hasAnyActivity && !hasAnyTime && !hasAnySales) {
            setOpenCard('activity');
          } else {
            setOpenCard(null);
          }
        } else {
          // New empty entry
          setDoorsKnocked("");
          setDecisionMakers("");
          setPitches("");
          setTransitions("");
          setPresentations("");
          setCloses("");
          setCustomCounters({});
          setStartTime("");
          setEndTime("");
          setLocalSales([]);
          setOpenCard('activity');
        }
        
        formInitializedRef.current = true;
        setIsFormReady(true);
      };

      requestAnimationFrame(() => {
        initializeForm();
      });
    }
    
    // Reset flags when sheet closes
    if (!open) {
      isSavingRef.current = false;
      formInitializedRef.current = false;
      setIsFormReady(false);
      setOpenCard(null);
      setStartTimeWarning(null);
      setEndTimeWarning(null);
      setAcknowledgedEarlyEnd(false);
      setShowInstallStep(false);
      setPendingSalesWithInstallTracking(null);
      setLocalSales([]);
      setEditingSale(null);
      setSuggestedSalesConfirmed(false);
    }
  }, [open, entry?.id]);

  // Auto-trigger save when skipSummaryView is true (for Track page current day saves)
  // This skips the summary UI and goes directly to the save flow (with install step if needed)
  const skipTriggeredRef = useRef(false);
  useEffect(() => {
    if (open && skipSummaryView && isFormReady && !skipTriggeredRef.current && !isSaving) {
      skipTriggeredRef.current = true;
      // Small delay to ensure form is fully ready then trigger save
      const timeoutId = setTimeout(() => {
        // Go directly to install step check / save
        const allSalesToCheck = [...salesLog];
        if (allSalesToCheck.length > 0) {
          const hasUnmarkedSales = allSalesToCheck.some(s => s.install_status === undefined);
          if (hasUnmarkedSales) {
            setShowInstallStep(true);
            return;
          }
        }
        // No unmarked sales - proceed directly to save
        proceedWithSave();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    // Reset when sheet closes
    if (!open) {
      skipTriggeredRef.current = false;
    }
  }, [open, skipSummaryView, isFormReady, isSaving, salesLog]);

  const hasResultsWithoutActivity = () => {
    const hasSales = allSales.length > 0;
    const hasAnyActivity = 
      (parseInt(doorsKnocked) || 0) > 0 ||
      (parseInt(decisionMakers) || 0) > 0 ||
      (parseInt(pitches) || 0) > 0 ||
      (parseInt(transitions) || 0) > 0 ||
      (parseInt(presentations) || 0) > 0 ||
      (parseInt(closes) || 0) > 0;
    
    return hasSales && !hasAnyActivity;
  };

  const hasUnusuallyHighValues = () => {
    const { fpPlus, totalPrmr } = calculatedMetrics;
    
    if (isRookie) {
      return fpPlus > 4 || totalPrmr > 425;
    } else if (isVet) {
      return fpPlus > 7 || totalPrmr > 850;
    }
    
    return false;
  };

  const handleSave = useCallback(() => {
    // Check if entry is already finalized
    if (entry?.is_finalized) {
      setShowOverwriteWarning(true);
      return;
    }
    
    // Check for unacknowledged end time warning
    if (endTimeWarning && !acknowledgedEarlyEnd) {
      setOpenCard('time');
      return;
    }
    
    // Check for data quality issue
    if (hasResultsWithoutActivity()) {
      setShowDataQualityWarning(true);
      return;
    }
    
    // Check for unusually high values
    if (hasUnusuallyHighValues()) {
      setShowHighValueWarning(true);
      return;
    }
    
    // If there are sales, show install confirmation step for unmarked sales
    // CRITICAL: Check ALL sales - both existing DB sales AND newly added local sales
    const allSalesToCheck = [...salesLog, ...localSales];
    if (allSalesToCheck.length > 0) {
      const hasUnmarkedSales = allSalesToCheck.some(s => s.install_status === undefined);
      if (hasUnmarkedSales) {
        setShowInstallStep(true);
        return;
      }
    }
    
    proceedWithSave();
  }, [entry?.is_finalized, endTimeWarning, acknowledgedEarlyEnd, salesLog, localSales]);

  const handleInstallConfirm = (updatedSales: Sale[]) => {
    setPendingSalesWithInstallTracking(updatedSales);
    setShowInstallStep(false);
    proceedWithSaveWithSales(updatedSales);
  };

  const proceedWithSave = async () => {
    // Combine existing salesLog with newly added localSales
    const combinedSales = [...salesLog, ...localSales];
    const salesToUse = pendingSalesWithInstallTracking || combinedSales;
    console.log('[SaveEntrySheet] proceedWithSave - salesLog:', salesLog.length, 'localSales:', localSales.length, 'using:', salesToUse.length);
    await proceedWithSaveWithSales(salesToUse);
  };

  const proceedWithSaveWithSales = async (salesToSave: Sale[]) => {
    isSavingRef.current = true;
    
    const saveDate = format(date, 'yyyy-MM-dd');
    console.log('[SaveEntrySheet] Saving entry for date:', saveDate, 'with', salesToSave.length, 'sales');
    
    // Auto-fill end time if not set
    let finalEndTime = endTime;
    if (startTime && !endTime) {
      const now = new Date();
      finalEndTime = format(now, 'HH:mm');
      setEndTime(finalEndTime);
    }
    
    // Convert times to ISO strings
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
    
    // Calculate final values from sales
    const fundedSales = salesToSave.filter(s => s.install_status !== 'cancelled');
    const fpSales = fundedSales.filter(s => s.type === 'fp');
    const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
    const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    
    const finalFpPlus = fpSales.length + (upgradePrmrTotal / 85);
    const finalPrmr = fpPrmrTotal + upgradePrmrTotal;
    const finalUpgradePrmr = upgradePrmrTotal > 0 ? upgradePrmrTotal : null;
    
    await onSave({
      doors_knocked: parseInt(doorsKnocked) || 0,
      decision_makers: parseInt(decisionMakers) || 0,
      pitches: parseInt(pitches) || 0,
      transitions: parseInt(transitions) || 0,
      presentations: parseInt(presentations) || 0,
      closes: salesToSave.length, // Closes = number of sales
      fp_plus: finalFpPlus,
      prmr: finalPrmr,
      upgrade_prmr: finalUpgradePrmr,
      saveDate,
      work_start_time: workStartTime,
      work_end_time: workEndTime,
      custom_counters: customCounterData,
      sales_log: salesToSave,
    });
    
    onOpenChange(false);
  };

  const calculateTotalTime = () => {
    if (!startTime && !endTime) {
      if (!entry?.work_start_time) return "Not started";
      
      const start = parseISO(entry.work_start_time);
      const end = entry.work_end_time ? parseISO(entry.work_end_time) : new Date();
      
      let totalMinutes = differenceInMinutes(end, start);
      
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
      
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
    
    if (!startTime) return "Set start time";
    if (!endTime) return "Set end time";
    
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startDate = new Date(date);
    startDate.setHours(startHours, startMinutes, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(endHours, endMinutes, 0, 0);
    
    let totalMinutes = differenceInMinutes(endDate, startDate);
    
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }
    
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
    
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleCardToggle = (card: OpenCardType) => {
    setOpenCard(openCard === card ? null : card);
  };

  // Handle adding a new sale via LogSaleSheet
  const handleLogSale = (saleData: Omit<Sale, 'id' | 'timestamp'>) => {
    const newSale: Sale = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...saleData,
    };
    console.log('[SaveEntrySheet] Adding new sale to localSales:', newSale.type, newSale.prmr);
    setLocalSales(prev => {
      const updated = [...prev, newSale];
      console.log('[SaveEntrySheet] localSales updated, count:', updated.length);
      return updated;
    });
    setShowLogSaleSheet(false);
  };

  // Handle updating a local sale
  const handleUpdateLocalSale = (updatedSale: Sale) => {
    setLocalSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    setEditingSale(null);
    setShowLogSaleSheet(false);
  };

  // Handle deleting a local sale
  const handleDeleteLocalSale = (saleId: string) => {
    setLocalSales(prev => prev.filter(s => s.id !== saleId));
    setEditingSale(null);
    setShowLogSaleSheet(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="pb-safe">
          <DrawerHeader className="mb-4 flex flex-row items-center justify-between">
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

          <div className="space-y-4 px-4 pb-4 overflow-y-auto flex-1 min-h-0">
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
                        const allCounters = [
                          { field: "doors_knocked", label: "Doors Knocked", value: doorsKnocked, setter: setDoorsKnocked },
                          { field: "decision_makers", label: "Decision Makers", value: decisionMakers, setter: setDecisionMakers },
                          { field: "pitches", label: "Pitches", value: pitches, setter: setPitches },
                          { field: "transitions", label: "Transitions", value: transitions, setter: setTransitions },
                          { field: "presentations", label: "Presentations", value: presentations, setter: setPresentations },
                          { field: "closes", label: "Closes", value: closes, setter: setCloses },
                        ];

                        let coreCounters = allCounters;
                        if (counterLayoutConfig?.order) {
                          coreCounters = counterLayoutConfig.order
                            .map(field => allCounters.find(c => c.field === field))
                            .filter((c): c is typeof allCounters[0] => c !== undefined);
                        }

                        return coreCounters.map((counter) => {
                          // Lock closes when there are sales (must add via + button)
                          const isClosesLocked = counter.field === 'closes' && allSales.length > 0;
                          
                          return (
                            <div key={counter.field} className="space-y-1.5">
                              <Label htmlFor={counter.field} className="text-sm">
                                {counter.label}
                                {isClosesLocked && (
                                  <span className="text-xs text-muted-foreground ml-1">(via sales)</span>
                                )}
                              </Label>
                              <Input
                                id={counter.field}
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                step="1"
                                placeholder=""
                                value={isClosesLocked ? allSales.length.toString() : counter.value}
                                onChange={(e) => counter.setter(e.target.value)}
                                enterKeyHint="next"
                                readOnly={isClosesLocked}
                                className={isClosesLocked ? 'bg-muted/50 cursor-not-allowed' : ''}
                                tabIndex={isClosesLocked ? -1 : 0}
                              />
                            </div>
                          );
                        });
                      })()}

                      {/* Custom counters */}
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

            {/* Sales Card - Add Sales via + Button */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base">Sales</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      setEditingSale(null);
                      setShowLogSaleSheet(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Sale
                  </Button>
                </div>

                {/* Legacy data with suggested sales */}
                {hasLegacyData && suggestedSales.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                        Suggested breakdown from {entry?.fp_plus?.toFixed(2)} FP+ / ${entry?.prmr?.toFixed(0)} PRMR:
                      </p>
                      
                      {/* Suggested sales chips */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {suggestedSales.map((sale) => (
                          <div
                            key={sale.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed ${
                              sale.type === 'fp'
                                ? 'bg-primary/5 text-primary border-primary/40'
                                : 'bg-emerald-500/5 text-emerald-600 border-emerald-500/40'
                            }`}
                          >
                            <span className="uppercase text-xs font-bold">
                              {sale.type === 'fp' ? 'FP' : 'UP'}
                            </span>
                            <span>${sale.prmr}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => {
                            // Confirm - add suggested sales with new IDs
                            const confirmedSales = suggestedSales.map(s => ({
                              ...s,
                              id: crypto.randomUUID(),
                            }));
                            setLocalSales(confirmedSales);
                            setSuggestedSalesConfirmed(true);
                          }}
                        >
                          <Check className="h-4 w-4" />
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => {
                            // Edit - start fresh, let user add manually
                            setSuggestedSalesConfirmed(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Manually
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
                
                {/* No sales and no legacy data */}
                {allSales.length === 0 && !hasLegacyData && suggestedSalesConfirmed === false ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">No sales logged</p>
                    <p className="text-xs mt-1">Tap "Add Sale" to log a sale</p>
                  </div>
                ) : null}
                
                {/* Show "add sales manually" state after user clicks "Edit Manually" */}
                {allSales.length === 0 && suggestedSalesConfirmed && !hasLegacyData ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">No sales logged</p>
                    <p className="text-xs mt-1">Tap "Add Sale" to log a sale</p>
                  </div>
                ) : null}
                
                {/* Sales list when there are sales */}
                {allSales.length > 0 && (
                  <div className="space-y-3">
                    {/* Sales chips */}
                    <div className="flex flex-wrap gap-2">
                      {allSales.map((sale) => {
                        const isCancelled = sale.install_status === 'cancelled';
                        const isPending = sale.install_status === 'pending';
                        const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
                        const isFromDb = salesLog.some(s => s.id === sale.id);
                        
                        return (
                          <button
                            key={sale.id}
                            type="button"
                            onClick={() => {
                              if (isFromDb) {
                                // Open detail sheet for DB sales
                                setSelectedSale(sale);
                                setShowSaleDetail(true);
                              } else {
                                // Edit local sales via LogSaleSheet
                                setEditingSale(sale);
                                setShowLogSaleSheet(true);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                              isCancelled 
                                ? 'bg-destructive/10 text-destructive line-through' 
                                : isPending
                                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                                  : sale.type === 'fp'
                                    ? 'bg-primary/10 text-primary border border-primary/30'
                                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
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

                    {/* Calculated totals */}
                    <div className="p-3 bg-accent/50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total FP+</span>
                        <span className="text-lg font-bold text-primary">{calculatedMetrics.fpPlus.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-muted-foreground">Total PRMR</span>
                        <span className="text-lg font-bold">${calculatedMetrics.totalPrmr.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                )}
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

      {/* Log Sale Sheet - Same as Track page */}
      <LogSaleSheet
        open={showLogSaleSheet}
        onOpenChange={setShowLogSaleSheet}
        onLogSale={handleLogSale}
        editingSale={editingSale}
        onUpdateSale={handleUpdateLocalSale}
        onDeleteSale={handleDeleteLocalSale}
        showPrmrHelper={showPrmrHelper}
        crmEnabled={repData?.crm_enabled || false}
        crmDetailedEnabled={repData?.crm_detailed_enabled || false}
        counterTimestamps={entry?.counter_timestamps}
      />

      {/* Sale Detail Sheet - For editing DB sales */}
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
        onDeleteSale={async (saleId) => {
          if (entry?.id) {
            deleteSale({
              entryId: entry.id,
              entryDate: format(date, 'yyyy-MM-dd'),
              saleId: saleId,
            });
          }
          setShowSaleDetail(false);
          setSelectedSale(null);
        }}
        crmEnabled={repData?.crm_enabled || false}
        crmDetailedEnabled={repData?.crm_detailed_enabled || false}
      />

      {/* Delete Entry Dialog */}
      <Drawer open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DrawerContent className="pb-safe">
          <DrawerHeader className="mb-6">
            <DrawerTitle>Delete Entry?</DrawerTitle>
            <DrawerDescription>
              This will permanently delete this entry. This action cannot be undone.
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="flex flex-col gap-3 px-4 pb-4">
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

      {/* Data Quality Warning */}
      <Drawer open={showDataQualityWarning} onOpenChange={setShowDataQualityWarning}>
        <DrawerContent className="pb-safe">
          <DrawerHeader className="mb-6">
            <DrawerTitle>Track While You Work 📊</DrawerTitle>
            <DrawerDescription>
              You've entered sales but no daily activity. For the most accurate 
              insights and data, track your numbers on the app while working next time!
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 text-sm text-muted-foreground mb-6">
            Tracking in real-time helps you see your true ratios (doors per sale, 
            pitches per close) and understand what it takes to succeed.
          </div>
          
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Button
              onClick={() => setShowDataQualityWarning(false)}
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

      {/* High Value Warning */}
      <Drawer open={showHighValueWarning} onOpenChange={setShowHighValueWarning}>
        <DrawerContent className="pb-safe">
          <DrawerHeader className="mb-6">
            <DrawerTitle>Double-Check Your Numbers 🤔</DrawerTitle>
            <DrawerDescription>
              {isRookie 
                ? `You entered ${calculatedMetrics.fpPlus.toFixed(1)} FP+ and $${calculatedMetrics.totalPrmr.toFixed(0)} PRMR. That's higher than usual for most rookies. Just want to make sure these numbers are correct!`
                : `You entered ${calculatedMetrics.fpPlus.toFixed(1)} FP+ and $${calculatedMetrics.totalPrmr.toFixed(0)} PRMR. That's higher than usual. Just want to make sure these numbers are correct!`
              }
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 text-sm text-muted-foreground mb-6">
            If these numbers are right, great work! If not, go back and adjust them.
          </div>
          
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Button
              onClick={() => setShowHighValueWarning(false)}
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

      {/* Overwrite Warning */}
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
          
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Button
              onClick={() => setShowOverwriteWarning(false)}
              variant="default"
              className="w-full py-6 text-lg font-semibold"
              size="lg"
            >
              Keep Existing Data
            </Button>
            <Button
              onClick={() => {
                setShowOverwriteWarning(false);
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
        salesLog={[...salesLog, ...localSales]}
        onConfirm={handleInstallConfirm}
      />
    </>
  );
};