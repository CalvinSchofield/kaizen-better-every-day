import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Trash2, HelpCircle, MapPin, Clock, Loader2, Search, CalendarIcon, X } from "lucide-react";
import { UpgradePrmrCalculator } from "@/components/UpgradePrmrCalculatorV2";
import { supabase } from "@/integrations/supabase/client";
import { Sale } from "@/hooks/useDailyEntry";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EdgeSwipeContainer } from "@/components/EdgeSwipeContainer";
import { useHeader } from "@/contexts/HeaderContext";

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

export default function LogSale() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Get state passed via navigation
  const navState = location.state as {
    editingSale?: Sale;
    showPrmrHelper?: boolean;
    crmEnabled?: boolean;
    crmDetailedEnabled?: boolean;
    counterTimestamps?: Record<string, string[]>;
    showDatePicker?: boolean;
    returnPath?: string;
  } | null;
  
  const editingSale = navState?.editingSale;
  const showPrmrHelper = navState?.showPrmrHelper ?? false;
  const crmEnabled = navState?.crmEnabled ?? true;
  const crmDetailedEnabled = navState?.crmDetailedEnabled ?? true;
  const counterTimestamps = navState?.counterTimestamps;
  const showDatePicker = navState?.showDatePicker ?? false;
  const returnPath = navState?.returnPath ?? '/track';

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          setMapboxToken(data.token);
        }
      } catch (e) {
        console.error('Failed to fetch Mapbox token:', e);
      }
    };
    fetchToken();
  }, []);

  // Calculate time since last transition and door knock
  useEffect(() => {
    if (crmDetailedEnabled && counterTimestamps) {
      const now = new Date().toISOString();
      
      let transitionMins: number | null = null;
      let doorMins: number | null = null;
      
      const transitions = counterTimestamps.transitions || [];
      if (transitions.length > 0) {
        const lastTransition = transitions[transitions.length - 1];
        transitionMins = getMinutesBetween(lastTransition, now);
        setSinceTransitionMinutes(transitionMins);
      } else {
        setSinceTransitionMinutes(null);
      }

      const doors = counterTimestamps.doors_knocked || [];
      if (doors.length > 0) {
        const lastDoor = doors[doors.length - 1];
        doorMins = getMinutesBetween(lastDoor, now);
        setSinceDoorMinutes(doorMins);
      } else {
        setSinceDoorMinutes(null);
      }
      
      if (transitionMins !== null && transitionMins > 0 && transitionMins < 480) {
        setTimeToSellSource('transition');
        setTimeToSellMinutes(Math.min(transitionMins, 120));
      } else if (doorMins !== null && doorMins > 0 && doorMins < 480) {
        setTimeToSellSource('door');
        setTimeToSellMinutes(Math.min(doorMins, 120));
      }
    }
  }, [crmDetailedEnabled, counterTimestamps]);

  // Auto-detect location on mount
  useEffect(() => {
    if (crmEnabled && mapboxToken && !editingSale && !customerAddress) {
      getLocation();
    }
  }, [crmEnabled, editingSale, mapboxToken]);

  // Populate form when editing
  useEffect(() => {
    if (editingSale) {
      setSaleType(editingSale.type);
      setPrmr(editingSale.prmr.toString());
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
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [editingSale]);

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

  const handleAddressChange = (value: string) => {
    setCustomerAddress(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  };

  const selectAddress = (suggestion: { place_name: string; center: [number, number] }) => {
    setCustomerAddress(suggestion.place_name);
    setCustomerLng(suggestion.center[0]);
    setCustomerLat(suggestion.center[1]);
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const getLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Location not supported');
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
          { headers: { 'Accept': 'application/json', 'User-Agent': 'KaizenApp/1.0' } }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.display_name) {
            const addr = data.address || {};
            const parts = [addr.house_number, addr.road, addr.city || addr.town || addr.village, addr.state, addr.postcode].filter(Boolean);
            setCustomerAddress(parts.join(', ') || data.display_name);
          }
        }
      } catch (geocodeError) {
        console.error('OSM reverse geocode failed:', geocodeError);
      }
    } catch (error: any) {
      if (error?.code === 1) {
        setLocationError('Location permission denied');
      } else {
        setLocationError('Could not get location');
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = () => {
    const prmrValue = parseFloat(prmr) || 0;
    
    const saleData: Omit<Sale, 'id' | 'timestamp'> = {
      type: saleType,
      prmr: prmrValue,
    };

    if (crmEnabled) {
      if (customerName.trim()) saleData.customer_name = customerName.trim();
      if (customerPhone.trim()) saleData.customer_phone = customerPhone.trim();
      if (accountNumber.trim()) saleData.customer_account_number = accountNumber.trim();
      if (customerAddress.trim()) saleData.customer_address = customerAddress.trim();
      if (customerLat !== null) saleData.customer_lat = customerLat;
      if (customerLng !== null) saleData.customer_lng = customerLng;

      if (crmDetailedEnabled) {
        saleData.time_to_sell_minutes = timeToSellMinutes;
        saleData.time_to_sell_source = timeToSellSource;
        saleData.deal_type = dealType;
        if (moneySpent.trim()) saleData.money_spent = parseInt(moneySpent) || 0;
        saleData.difficulty = difficulty;
      }
    }
    
    // Navigate back with the sale data
    if (showDatePicker) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const entryDate = `${year}-${month}-${day}`;
      
      const [hours, minutes] = selectedTime.split(':');
      const timestamp = new Date(selectedDate);
      timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      navigate(returnPath, { 
        state: { 
          saleLogged: true, 
          saleData, 
          entryDate, 
          timestamp: timestamp.toISOString(),
          editingSaleId: editingSale?.id 
        },
        replace: true 
      });
    } else {
      navigate(returnPath, { 
        state: { 
          saleLogged: true, 
          saleData,
          editingSaleId: editingSale?.id 
        },
        replace: true 
      });
    }
  };

  const handleCancel = () => {
    navigate(returnPath, { 
      state: { saleCancelled: true },
      replace: true 
    });
  };

  const handleDelete = () => {
    if (editingSale) {
      navigate(returnPath, { 
        state: { saleDeleted: true, deletedSaleId: editingSale.id },
        replace: true 
      });
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

  const { setCustomTitle, setCustomRightContent } = useHeader();

  // Set header title and cancel button
  useEffect(() => {
    setCustomTitle(isEditing ? "Edit Sale" : "Log Sale");
    setCustomRightContent(
      <Button variant="ghost" size="sm" onClick={() => {
        navigate(returnPath, { state: { saleCancelled: true }, replace: true });
      }} className="gap-1">
        <X className="w-4 h-4" />
        Cancel
      </Button>
    );
    return () => { setCustomTitle(null); setCustomRightContent(null); };
  }, [isEditing]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Scrollable Content */}
      <div className="flex-1 px-4 py-4 pb-32 space-y-5 overflow-y-auto">
        {/* Sale Type Toggle */}
        <div className="flex gap-2 p-1 bg-muted rounded-xl">
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

        {/* Date/Time Picker */}
        {showDatePicker && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">When did this sale happen?</p>
            
            <div className="grid grid-cols-2 gap-3">
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
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center font-normal h-12"
                    onClick={() => {
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
            {(showPrmrHelper || saleType === 'upgrade') && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
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

        {/* CRM Fields */}
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
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="pr-10 h-10"
                />
                {isGettingLocation && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {isSearchingAddress && !isGettingLocation && (
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-pulse" />
                )}
                {!isGettingLocation && !isSearchingAddress && customerLat && (
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                )}
                
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectAddress(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {suggestion.place_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {locationError && (
                <button 
                  onClick={getLocation}
                  className="text-xs text-destructive hover:underline"
                >
                  {locationError}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detailed CRM Fields */}
        {crmEnabled && crmDetailedEnabled && (
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sale Details</p>
            
            {/* Time to Sell */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Time to Sell
                </Label>
                <span className="text-sm font-medium">{formatMinutes(timeToSellMinutes)}</span>
              </div>
              
              {(sinceTransitionMinutes !== null || sinceDoorMinutes !== null) && (
                <div className="flex gap-2 mb-2">
                  {sinceTransitionMinutes !== null && sinceTransitionMinutes > 0 && sinceTransitionMinutes < 480 && (
                    <button
                      type="button"
                      onClick={() => handleTimeSourceChange('transition')}
                      className={cn(
                        "px-2 py-1 text-xs rounded-full transition-colors",
                        timeToSellSource === 'transition'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      Since transition ({formatMinutes(sinceTransitionMinutes)})
                    </button>
                  )}
                  {sinceDoorMinutes !== null && sinceDoorMinutes > 0 && sinceDoorMinutes < 480 && (
                    <button
                      type="button"
                      onClick={() => handleTimeSourceChange('door')}
                      className={cn(
                        "px-2 py-1 text-xs rounded-full transition-colors",
                        timeToSellSource === 'door'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      Since door ({formatMinutes(sinceDoorMinutes)})
                    </button>
                  )}
                </div>
              )}
              
              <Slider
                value={[timeToSellMinutes]}
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

            {/* Deal Type - Only show for FP sales, not upgrades */}
            {saleType === 'fp' && (
            <div className="space-y-2">
              <Label className="text-xs">Deal Type</Label>
              <div className="flex gap-2">
                {(['fresh', 'takeover', 'diy'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDealType(type)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all capitalize",
                      dealType === type
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {type === 'diy' ? 'DIY' : type}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Money Spent */}
            <div className="space-y-1">
              <Label className="text-xs">Money Spent (Optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
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
              <Label className="text-xs">Difficulty</Label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all capitalize",
                      difficulty === level
                        ? level === 'easy' ? "bg-success text-success-foreground" 
                          : level === 'medium' ? "bg-warning text-warning-foreground"
                          : "bg-destructive text-destructive-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t px-4 py-4 space-y-2 z-[60]"
        style={{ paddingBottom: 'calc(var(--effective-safe-area-bottom) + 4rem)' }}
      >
        <Button
          onClick={handleSubmit}
          className="w-full h-12 text-base font-semibold"
        >
          {isEditing ? "Update Sale" : "Log Sale"}
        </Button>
        
        {isEditing && (
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

      {/* Upgrade PRMR Calculator */}
      <UpgradePrmrCalculator
        open={showCalculator}
        onOpenChange={setShowCalculator}
        onPrmrCalculated={(value) => {
          setPrmr(value.toFixed(2));
          setShowCalculator(false);
        }}
      />
    </div>
  );
}
