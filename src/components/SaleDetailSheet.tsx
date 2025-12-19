import { useState, useEffect, useRef } from "react";
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
import { Sale } from "@/hooks/useDailyEntry";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { Trash2, MapPin, Loader2, CheckCircle, Clock, Ban } from "lucide-react";
import { toast } from "sonner";

interface SaleDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  entryDate: string;
  onUpdateSale: (updatedSale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  crmEnabled?: boolean;
  crmDetailedEnabled?: boolean;
}

// Helper to format minutes to readable string
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
};

export const SaleDetailSheet = ({
  open,
  onOpenChange,
  sale,
  entryDate,
  onUpdateSale,
  onDeleteSale,
  crmEnabled = false,
  crmDetailedEnabled = false,
}: SaleDetailSheetProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [saleType, setSaleType] = useState<'fp' | 'upgrade'>('fp');
  const [prmr, setPrmr] = useState("");
  const [saleTime, setSaleTime] = useState("12:00");
  
  // CRM state (simple)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // CRM state (detailed)
  const [timeToSellMinutes, setTimeToSellMinutes] = useState<number>(30);
  const [dealType, setDealType] = useState<'fresh' | 'takeover' | 'diy'>('fresh');
  const [moneySpent, setMoneySpent] = useState("");
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  
  // Install status
  const [installStatus, setInstallStatus] = useState<'installed' | 'pending' | 'cancelled'>('installed');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form when sale changes
  useEffect(() => {
    if (sale && open) {
      setSaleType(sale.type);
      setPrmr(sale.prmr.toString());
      const time = format(parseISO(sale.timestamp), 'HH:mm');
      setSaleTime(time);
      setInstallStatus(sale.install_status || 'installed');
      
      // CRM fields
      setCustomerName(sale.customer_name || "");
      setCustomerPhone(sale.customer_phone || "");
      setAccountNumber(sale.customer_account_number || "");
      setCustomerAddress(sale.customer_location || "");
      setCustomerLat(sale.customer_lat || null);
      setCustomerLng(sale.customer_lng || null);
      setTimeToSellMinutes(sale.time_to_sell_minutes || 30);
      setDealType(sale.deal_type || 'fresh');
      setMoneySpent(sale.money_spent?.toString() || "");
      setDifficulty(sale.difficulty || 'medium');
      setLocationError(null);
      setShowDeleteConfirm(false);
    }
  }, [sale, open]);

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
        // Still have coordinates even if geocoding failed
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

  if (!sale) return null;

  const handleSubmit = () => {
    const prmrValue = parseFloat(prmr) || 0;
    
    // Parse the time and create new timestamp
    const [hours, minutes] = saleTime.split(':').map(Number);
    const originalDate = parseISO(sale.timestamp);
    const newTimestamp = setMinutes(setHours(originalDate, hours), minutes);
    
    const updatedSale: Sale = {
      ...sale,
      type: saleType,
      prmr: prmrValue,
      timestamp: newTimestamp.toISOString(),
      install_status: installStatus,
    };

    // Add CRM fields if enabled
    if (crmEnabled) {
      updatedSale.customer_name = customerName.trim() || undefined;
      updatedSale.customer_phone = customerPhone.trim() || undefined;
      updatedSale.customer_account_number = accountNumber.trim() || undefined;
      updatedSale.customer_location = customerAddress.trim() || undefined;
      if (customerLat !== null) updatedSale.customer_lat = customerLat;
      if (customerLng !== null) updatedSale.customer_lng = customerLng;

      if (crmDetailedEnabled) {
        updatedSale.time_to_sell_minutes = timeToSellMinutes;
        updatedSale.deal_type = dealType;
        updatedSale.money_spent = moneySpent.trim() ? parseInt(moneySpent) : undefined;
        updatedSale.difficulty = difficulty;
      }
    }
    
    onUpdateSale(updatedSale);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (showDeleteConfirm && onDeleteSale) {
      onDeleteSale(sale.id);
      onOpenChange(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const dateStr = format(parseISO(entryDate), 'MMM d, yyyy');
  const timeStr = format(parseISO(sale.timestamp), 'h:mm a');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-xl">
            Edit Sale
          </DrawerTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {dateStr} at {timeStr}
          </p>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto flex-1 min-h-0 max-h-[70dvh]">
          {/* Funding Status Toggle */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Funding Status
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInstallStatus('installed')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  installStatus === 'installed'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Funded
              </button>
              <button
                type="button"
                onClick={() => setInstallStatus('pending')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  installStatus === 'pending'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pending
              </button>
              <button
                type="button"
                onClick={() => setInstallStatus('cancelled')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  installStatus === 'cancelled'
                    ? 'bg-destructive text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                Unfunded
              </button>
            </div>
          </div>

          {/* Sale Type Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => setSaleType('fp')}
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
              onClick={() => setSaleType('upgrade')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                saleType === 'upgrade'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Upgrade
            </button>
          </div>

          {/* PRMR Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              PRMR Amount
            </label>
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

          {/* Sale Time */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Sale Time
            </Label>
            <Input
              type="time"
              value={saleTime}
              onChange={(e) => setSaleTime(e.target.value)}
              className="h-12"
            />
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
                    placeholder="Customer address"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {isGettingLocation && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {!isGettingLocation && !customerAddress && (
                    <button
                      type="button"
                      onClick={getLocation}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary text-xs font-medium"
                    >
                      Get Location
                    </button>
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
              </div>
            </div>
          )}

          {/* CRM Fields (Detailed) */}
          {crmEnabled && crmDetailedEnabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sale Details</p>

              {/* Time to Sell Slider */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Time to Sell
                </Label>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatMinutes(timeToSellMinutes)}</span>
                    <span>5 min - 4 hrs</span>
                  </div>
                  <Slider
                    value={[timeToSellMinutes]}
                    onValueChange={([val]) => setTimeToSellMinutes(val)}
                    min={5}
                    max={240}
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
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 text-base font-semibold"
              disabled={!prmr || parseFloat(prmr) <= 0}
            >
              Update Sale
            </Button>
            
            {onDeleteSale && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className={`w-full h-10 ${
                  showDeleteConfirm 
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                    : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                }`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {showDeleteConfirm ? 'Tap Again to Confirm Delete' : 'Delete Sale'}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
