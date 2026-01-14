import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2, HelpCircle, MapPin, Clock, Loader2, Search, CalendarIcon } from "lucide-react";
import { UpgradePrmrCalculator } from "./UpgradePrmrCalculator";
import { supabase } from "@/integrations/supabase/client";
import { Sale } from "@/hooks/useDailyEntry";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LogSaleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  editingSale?: Sale | null;
  onUpdateSale?: (sale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  showPrmrHelper?: boolean;
  // CRM configuration
  crmEnabled?: boolean;
  crmDetailedEnabled?: boolean;
  // Counter timestamps for time-to-sell calculation
  counterTimestamps?: Record<string, string[]>;
  // Tour control props - for external control during tours
  tourForceUpgrade?: boolean;
  tourForceCalculatorOpen?: boolean;
  // Date picker mode - for adding sales from CRM
  showDatePicker?: boolean;
  onLogSaleWithDate?: (sale: Omit<Sale, 'id' | 'timestamp'>, date: string, timestamp: string) => void;
}

// Helper to calculate minutes between two timestamps
const getMinutesBetween = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
};

// Helper to format minutes as human readable
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

export const LogSaleSheet = ({
  open,
  onOpenChange,
  onLogSale,
  editingSale,
  onUpdateSale,
  onDeleteSale,
  showPrmrHelper = false,
  crmEnabled = false,
  crmDetailedEnabled = false,
  counterTimestamps,
  tourForceUpgrade = false,
  tourForceCalculatorOpen = false,
  showDatePicker = false,
  onLogSaleWithDate,
}: LogSaleSheetProps) => {
  const [saleType, setSaleType] = useState<'fp' | 'upgrade'>('fp');
  const [prmr, setPrmr] = useState("");
  const [showHelperContent, setShowHelperContent] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // CRM state (simple)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Address autocomplete state
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{
    place_name: string;
    center: [number, number];
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // CRM state (detailed)
  const [timeToSellMinutes, setTimeToSellMinutes] = useState<number>(30);
  const [timeToSellSource, setTimeToSellSource] = useState<'transition' | 'door' | 'manual'>('manual');
  const [dealType, setDealType] = useState<'fresh' | 'takeover' | 'diy'>('fresh');
  const [moneySpent, setMoneySpent] = useState("");
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Calculated times from counter timestamps
  const [sinceTransitionMinutes, setSinceTransitionMinutes] = useState<number | null>(null);
  const [sinceDoorMinutes, setSinceDoorMinutes] = useState<number | null>(null);

  // Tour-controlled overrides
  useEffect(() => {
    if (tourForceUpgrade) {
      setSaleType('upgrade');
    }
  }, [tourForceUpgrade]);

  useEffect(() => {
    if (tourForceCalculatorOpen && saleType === 'upgrade') {
      setShowCalculator(true);
    }
  }, [tourForceCalculatorOpen, saleType]);

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          setMapboxToken(data.token);
        } else {
          console.error('Failed to fetch Mapbox token:', error);
        }
      } catch (e) {
        console.error('Failed to fetch Mapbox token:', e);
      }
    };
    fetchToken();
  }, []);

  // Calculate time since last transition and door knock when sheet opens
  useEffect(() => {
    if (open && crmDetailedEnabled && counterTimestamps) {
      const now = new Date().toISOString();
      
      let transitionMins: number | null = null;
      let doorMins: number | null = null;
      
      // Get last transition timestamp
      const transitions = counterTimestamps.transitions || [];
      if (transitions.length > 0) {
        const lastTransition = transitions[transitions.length - 1];
        transitionMins = getMinutesBetween(lastTransition, now);
        setSinceTransitionMinutes(transitionMins);
      } else {
        setSinceTransitionMinutes(null);
      }

      // Get last door knock timestamp
      const doors = counterTimestamps.doors_knocked || [];
      if (doors.length > 0) {
        const lastDoor = doors[doors.length - 1];
        doorMins = getMinutesBetween(lastDoor, now);
        setSinceDoorMinutes(doorMins);
      } else {
        setSinceDoorMinutes(null);
      }
      
      // Auto-select the best source: prefer transition, fallback to door
      // Only use times that are reasonable (> 0 and < 8 hours)
      if (transitionMins !== null && transitionMins > 0 && transitionMins < 480) {
        setTimeToSellSource('transition');
        setTimeToSellMinutes(Math.min(transitionMins, 120)); // Cap at 2 hours
      } else if (doorMins !== null && doorMins > 0 && doorMins < 480) {
        setTimeToSellSource('door');
        setTimeToSellMinutes(Math.min(doorMins, 120)); // Cap at 2 hours
      }
    }
  }, [open, crmDetailedEnabled, counterTimestamps]);

  // Auto-detect location when sheet opens with CRM enabled and token is ready
  useEffect(() => {
    if (open && crmEnabled && mapboxToken && !editingSale && !customerAddress) {
      getLocation();
    }
  }, [open, crmEnabled, editingSale, mapboxToken]);

  // Search for address suggestions using Mapbox
  const searchAddresses = useCallback(async (query: string) => {
    if (!mapboxToken || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    
    setIsSearchingAddress(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=US&types=address&limit=5`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAddressSuggestions(data.features || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Address search error:', error);
    } finally {
      setIsSearchingAddress(false);
    }
  }, [mapboxToken]);

  // Handle address input change with debounce
  const handleAddressChange = (value: string) => {
    setCustomerAddress(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  };

  // Select an address from suggestions
  const selectAddress = (suggestion: { place_name: string; center: [number, number] }) => {
    setCustomerAddress(suggestion.place_name);
    setCustomerLng(suggestion.center[0]);
    setCustomerLat(suggestion.center[1]);
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const getLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Location not supported on this device');
      return;
    }
    
    setIsGettingLocation(true);
    setLocationError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        });
      });

      const { latitude, longitude } = position.coords;
      setCustomerLat(latitude);
      setCustomerLng(longitude);
      
      // Try Mapbox reverse geocoding first (more reliable)
      if (mapboxToken) {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=address&limit=1`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              setCustomerAddress(data.features[0].place_name);
              return;
            }
          }
        } catch (e) {
          console.error('Mapbox reverse geocode failed:', e);
        }
      }
      
      // Fallback to OpenStreetMap
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'KaizenApp/1.0'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.display_name) {
            const addr = data.address || {};
            const parts = [
              addr.house_number,
              addr.road,
              addr.city || addr.town || addr.village,
              addr.state,
              addr.postcode
            ].filter(Boolean);
            const formattedAddress = parts.join(', ') || data.display_name;
            setCustomerAddress(formattedAddress);
          }
        }
      } catch (geocodeError) {
        console.error('OSM reverse geocode failed:', geocodeError);
      }
    } catch (error: any) {
      if (error?.code === 1) {
        setLocationError('Location permission denied. Tap to retry.');
      } else if (error?.code === 2) {
        setLocationError('Location unavailable. Tap to retry.');
      } else if (error?.code === 3) {
        setLocationError('Location timed out. Tap to retry.');
      } else {
        setLocationError('Could not get location. Tap to retry.');
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Reset form when opening, populate when editing
  useEffect(() => {
    if (open) {
      if (editingSale) {
        setSaleType(editingSale.type);
        setPrmr(editingSale.prmr.toString());
        // CRM fields
        setCustomerName(editingSale.customer_name || "");
        setCustomerPhone(editingSale.customer_phone || "");
        setAccountNumber(editingSale.customer_account_number || "");
        setCustomerAddress(editingSale.customer_address || "");
        setCustomerLat(editingSale.customer_lat || null);
        setCustomerLng(editingSale.customer_lng || null);
        setTimeToSellMinutes(editingSale.time_to_sell_minutes || 30);
        setTimeToSellSource(editingSale.time_to_sell_source || 'manual');
        setDealType(editingSale.deal_type || 'fresh');
        setMoneySpent(editingSale.money_spent?.toString() || "");
        setDifficulty(editingSale.difficulty || 'medium');
      } else {
        setSaleType('fp');
        setPrmr("");
        // Reset CRM fields
        setCustomerName("");
        setCustomerPhone("");
        setAccountNumber("");
        setCustomerAddress("");
        setCustomerLat(null);
        setCustomerLng(null);
        setLocationError(null);
        setTimeToSellMinutes(30);
        setTimeToSellSource('manual');
        setDealType('fresh');
        setMoneySpent("");
        setDifficulty('medium');
        // Reset date picker to today/now
        setSelectedDate(new Date());
        const now = new Date();
        setSelectedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      }
      setShowHelperContent(false);
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, editingSale]);

  const handleSubmit = () => {
    const prmrValue = parseFloat(prmr) || 0;
    
    const saleData: Omit<Sale, 'id' | 'timestamp'> = {
      type: saleType,
      prmr: prmrValue,
    };

    // Add CRM fields if enabled
    if (crmEnabled) {
      if (customerName.trim()) saleData.customer_name = customerName.trim();
      if (customerPhone.trim()) saleData.customer_phone = customerPhone.trim();
      if (accountNumber.trim()) saleData.customer_account_number = accountNumber.trim();
      if (customerAddress.trim()) saleData.customer_address = customerAddress.trim();
      if (customerLat !== null) saleData.customer_lat = customerLat;
      if (customerLng !== null) saleData.customer_lng = customerLng;

      // Add detailed CRM fields if enabled
      if (crmDetailedEnabled) {
        saleData.time_to_sell_minutes = timeToSellMinutes;
        saleData.time_to_sell_source = timeToSellSource;
        saleData.deal_type = dealType;
        if (moneySpent.trim()) saleData.money_spent = parseInt(moneySpent) || 0;
        saleData.difficulty = difficulty;
      }
    }
    
    if (editingSale && onUpdateSale) {
      onUpdateSale({
        ...editingSale,
        ...saleData,
      });
    } else if (showDatePicker && onLogSaleWithDate) {
      // Date picker mode - send with selected date and time
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const entryDate = `${year}-${month}-${day}`;
      
      // Create timestamp from date + time
      const [hours, minutes] = selectedTime.split(':');
      const timestamp = new Date(selectedDate);
      timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      onLogSaleWithDate(saleData, entryDate, timestamp.toISOString());
    } else {
      onLogSale(saleData);
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (editingSale && onDeleteSale) {
      onDeleteSale(editingSale.id);
      onOpenChange(false);
    }
  };

  const handleHelperClick = () => {
    if (saleType === 'upgrade') {
      setShowCalculator(true);
    } else {
      setShowHelperContent(!showHelperContent);
    }
  };

  const handleTimeSourceChange = (source: 'transition' | 'door') => {
    setTimeToSellSource(source);
    if (source === 'transition' && sinceTransitionMinutes !== null) {
      setTimeToSellMinutes(sinceTransitionMinutes);
    } else if (source === 'door' && sinceDoorMinutes !== null) {
      setTimeToSellMinutes(sinceDoorMinutes);
    }
  };

  const isEditing = !!editingSale;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85svh] flex flex-col" data-tour="track-log-sale-sheet">
        <DrawerHeader className="text-center pb-2 shrink-0">
          <DrawerTitle className="text-xl">
            {isEditing ? "Edit Sale" : "Nice! 🎉"}
          </DrawerTitle>
          {!isEditing && (
            <p className="text-sm text-muted-foreground mt-1">
              Log this sale's details
            </p>
          )}
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-5 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          {/* Sale Type Toggle */}
          <div data-tour="track-sale-type-toggle" className="flex gap-2 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSaleType('fp');
                setShowHelperContent(false);
              }}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                saleType === 'fp'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              FP (New Account)
            </button>
            <button
              type="button"
              onClick={() => {
                setSaleType('upgrade');
                setShowHelperContent(false);
              }}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                saleType === 'upgrade'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Upgrade
            </button>
          </div>

          {/* Date/Time Picker (when showDatePicker is enabled) */}
          {showDatePicker && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">When did this sale happen?</p>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Date Picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-12",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDate(date);
                            setDatePickerOpen(false);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time Picker - styled to match date picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-center text-left font-normal h-12",
                        !selectedTime && "text-muted-foreground"
                      )}
                      onClick={() => {
                        // Focus the hidden input when clicking the button
                        const input = document.getElementById('sale-time-input');
                        if (input) input.click();
                      }}
                    >
                      <span className="text-base">
                        {selectedTime ? format(new Date(`2000-01-01T${selectedTime}`), "h:mm a") : "Pick time"}
                      </span>
                    </Button>
                    <input
                      id="sale-time-input"
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRMR Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                PRMR Amount
              </label>
              {/* Show help icon for FP only if showPrmrHelper is true, but ALWAYS show for upgrades */}
              {(showPrmrHelper || saleType === 'upgrade') && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-tour="track-prmr-help-button"
                        onClick={handleHelperClick}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p className="text-xs">
                        {saleType === 'upgrade' 
                          ? "Tap to open the PRMR calculator for upgrades"
                          : "Tap for help finding your PRMR"
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {/* FP Helper Content */}
            {showPrmrHelper && showHelperContent && saleType === 'fp' && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">How to find PRMR on Street Genie:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>On the account in Street Genie, click the <span className="font-medium text-foreground">three dots</span> (top right)</li>
                  <li>Select <span className="font-medium text-foreground">PRMR Estimator</span></li>
                </ol>
                <p className="text-xs text-muted-foreground italic mt-2">
                  *Check Curator the next day to ensure accuracy
                </p>
              </div>
            )}
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={prmr}
                onChange={(e) => setPrmr(e.target.value)}
                className="pl-9 text-2xl font-bold h-14 text-center"
              />
            </div>
          </div>

          {/* CRM Fields (Simple) */}
          {crmEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Info</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Account Number</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                    A-
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="12345678"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    className="pl-8 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Location
                </Label>
                <div className="relative">
                  <Input
                    ref={addressInputRef}
                    placeholder="Start typing address..."
                    value={customerAddress}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    className="h-10 pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {(isGettingLocation || isSearchingAddress) && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {!isGettingLocation && (
                      <button
                        type="button"
                        onClick={getLocation}
                        className="text-primary text-[10px] font-medium bg-primary/10 px-1.5 py-0.5 rounded"
                      >
                        📍 GPS
                      </button>
                    )}
                  </div>
                  
                  {/* Address Autocomplete Suggestions */}
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                      {addressSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm border-b border-border last:border-b-0 flex items-start gap-2"
                          onClick={() => selectAddress(suggestion)}
                        >
                          <Search className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <span className="line-clamp-2">{suggestion.place_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {locationError && !customerAddress && (
                  <button 
                    type="button"
                    onClick={getLocation}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    {locationError}
                  </button>
                )}
                {customerLat && customerLng && (
                  <p className="text-[10px] text-muted-foreground">
                    📍 Location saved
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CRM Fields (Detailed) */}
          {crmEnabled && crmDetailedEnabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sale Details</p>

              {/* Time to Sell */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Time to Sell
                </Label>
                
                {/* Source Selection */}
                {(sinceTransitionMinutes !== null || sinceDoorMinutes !== null) && (
                  <div className="flex gap-2">
                    {sinceTransitionMinutes !== null && (
                      <button
                        type="button"
                        onClick={() => handleTimeSourceChange('transition')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          timeToSellSource === 'transition'
                            ? 'bg-primary/10 border-2 border-primary text-primary'
                            : 'bg-muted border border-border text-muted-foreground'
                        }`}
                      >
                        Since Transition
                        <div className="text-[10px] opacity-70">{formatMinutes(sinceTransitionMinutes)}</div>
                      </button>
                    )}
                    {sinceDoorMinutes !== null && (
                      <button
                        type="button"
                        onClick={() => handleTimeSourceChange('door')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          timeToSellSource === 'door'
                            ? 'bg-primary/10 border-2 border-primary text-primary'
                            : 'bg-muted border border-border text-muted-foreground'
                        }`}
                      >
                        Since Door
                        <div className="text-[10px] opacity-70">{formatMinutes(sinceDoorMinutes)}</div>
                      </button>
                    )}
                  </div>
                )}

                {/* Slider for adjustment */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Adjust: {formatMinutes(timeToSellMinutes)}</span>
                    <span>5 min - 2 hrs</span>
                  </div>
                  <Slider
                    value={[Math.min(timeToSellMinutes, 120)]}
                    onValueChange={([val]) => {
                      setTimeToSellMinutes(val);
                      setTimeToSellSource('manual');
                    }}
                    min={5}
                    max={120}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Deal Type - FP only */}
              {saleType === 'fp' && (
                <div className="space-y-2">
                  <Label className="text-xs">Deal Type</Label>
                  <div className="flex gap-2">
                    {(['fresh', 'takeover', 'diy'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDealType(type)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          dealType === type
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {type === 'fresh' ? '🚪 Fresh' : type === 'takeover' ? '🔄 Takeover' : '📷 DIY'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {dealType === 'fresh' ? 'Doorbell cam at most' : dealType === 'takeover' ? 'Had an alarm system' : 'Had their own cameras'}
                  </p>
                </div>
              )}

              {/* Money Spent */}
              <div className="space-y-1">
                <Label className="text-xs">Money Spent to Get Deal</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={moneySpent}
                    onChange={(e) => setMoneySpent(e.target.value)}
                    className="pl-7 h-10"
                  />
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label className="text-xs">How Hard to Sell?</Label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        difficulty === level
                          ? level === 'easy' 
                            ? 'bg-emerald-500 text-white shadow-md'
                            : level === 'medium'
                              ? 'bg-amber-500 text-white shadow-md'
                              : 'bg-red-500 text-white shadow-md'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {level === 'easy' ? '😊 Easy' : level === 'medium' ? '😐 Medium' : '😤 Hard'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 text-base font-semibold"
              disabled={!prmr || parseFloat(prmr) <= 0}
            >
              {isEditing ? "Update Sale" : "Log Sale"}
            </Button>
            
            {isEditing && onDeleteSale && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Sale
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>

      {/* Upgrade PRMR Calculator */}
      <UpgradePrmrCalculator
        open={showCalculator}
        onOpenChange={setShowCalculator}
        onPrmrCalculated={(value) => {
          setPrmr(value.toFixed(2));
          setShowCalculator(false);
        }}
      />
    </Drawer>
  );
};