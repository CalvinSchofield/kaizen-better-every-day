import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, DollarSign, Target, ChevronDown, ChevronUp } from "lucide-react";
import { 
  calculateTakeHome, 
  calculateRequiredFp, 
  formatCurrency, 
  getRentTypes,
  getTier
} from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";

interface PayscaleCalculatorProps {
  onCalculate?: (fpGoal: number, takeHome: number) => void;
  initialFpGoal?: number;
  initialAvgPrmr?: number;
  initialRentType?: string;
  initialWeeks?: number;
  initialUpgradeFp?: number;
  compact?: boolean;
}

export const PayscaleCalculator = ({
  onCalculate,
  initialFpGoal = 80,
  initialAvgPrmr = 85,
  initialRentType = 'Single',
  initialWeeks = 18,
  initialUpgradeFp = 0,
  compact = false,
}: PayscaleCalculatorProps) => {
  const [mode, setMode] = useState<'fpToEarnings' | 'earningsToFp'>('fpToEarnings');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Inputs
  const [fpGoal, setFpGoal] = useState(initialFpGoal);
  const [targetEarnings, setTargetEarnings] = useState(50000);
  const [avgPrmrPerFp, setAvgPrmrPerFp] = useState(initialAvgPrmr);
  const [upgradeFpGoal, setUpgradeFpGoal] = useState(initialUpgradeFp);
  const [rentType, setRentType] = useState(initialRentType);
  const [weeksWorking, setWeeksWorking] = useState(initialWeeks);

  // Results
  const [result, setResult] = useState(() => calculateTakeHome({
    fpGoal: initialFpGoal,
    avgPrmrPerFp: initialAvgPrmr,
    upgradeFpGoal: initialUpgradeFp,
    rentType: initialRentType,
    weeksWorking: initialWeeks,
  }));

  useEffect(() => {
    if (mode === 'fpToEarnings') {
      const newResult = calculateTakeHome({
        fpGoal,
        avgPrmrPerFp,
        upgradeFpGoal,
        rentType,
        weeksWorking,
      });
      setResult(newResult);
      onCalculate?.(fpGoal, newResult.takeHomePay);
    } else {
      const requiredFp = calculateRequiredFp({
        targetEarnings,
        avgPrmrPerFp,
        upgradeFpGoal,
        rentType,
        weeksWorking,
      });
      setFpGoal(requiredFp);
      const newResult = calculateTakeHome({
        fpGoal: requiredFp,
        avgPrmrPerFp,
        upgradeFpGoal,
        rentType,
        weeksWorking,
      });
      setResult(newResult);
      onCalculate?.(requiredFp, newResult.takeHomePay);
    }
  }, [mode, fpGoal, targetEarnings, avgPrmrPerFp, upgradeFpGoal, rentType, weeksWorking]);

  const tier = getTier(result.totalFpPlus);

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={fpGoal}
            onChange={(e) => setFpGoal(Number(e.target.value))}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">FP+ →</span>
          <span className="font-bold text-primary">{formatCurrency(result.takeHomePay)}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-primary" />
          Payscale Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fpToEarnings" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              FP+ → Earnings
            </TabsTrigger>
            <TabsTrigger value="earningsToFp" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" />
              Earnings → FP+
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fpToEarnings" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="fpGoal">FP+ Goal</Label>
              <Input
                id="fpGoal"
                type="number"
                value={fpGoal}
                onChange={(e) => setFpGoal(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </TabsContent>

          <TabsContent value="earningsToFp" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="targetEarnings">Target Earnings ($)</Label>
              <Input
                id="targetEarnings"
                type="number"
                value={targetEarnings}
                onChange={(e) => setTargetEarnings(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Result Display */}
        <div className="rounded-xl bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            {mode === 'fpToEarnings' ? 'Take-Home Pay' : 'Required FP+'}
          </p>
          <p className="text-3xl font-bold text-primary">
            {mode === 'fpToEarnings' 
              ? formatCurrency(result.takeHomePay)
              : `${fpGoal} FP+`
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Rate: ${tier.rate}/PRMR • Tier: {tier.min}-{tier.max === Infinity ? '300+' : tier.max}
          </p>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <span>Advanced Settings</span>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Advanced Settings */}
        <div className={cn(
          "space-y-4 overflow-hidden transition-all duration-200",
          showAdvanced ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="avgPrmr" className="text-xs">Avg PRMR/FP</Label>
              <Input
                id="avgPrmr"
                type="number"
                value={avgPrmrPerFp}
                onChange={(e) => setAvgPrmrPerFp(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="upgradeFp" className="text-xs">Upgrade FP+</Label>
              <Input
                id="upgradeFp"
                type="number"
                value={upgradeFpGoal}
                onChange={(e) => setUpgradeFpGoal(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rentType" className="text-xs">Rent Type</Label>
              <Select value={rentType} onValueChange={setRentType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getRentTypes().map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="weeks" className="text-xs">Weeks Working</Label>
              <Input
                id="weeks"
                type="number"
                value={weeksWorking}
                onChange={(e) => setWeeksWorking(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Breakdown */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
            <div className="flex justify-between">
              <span>Total FP+:</span>
              <span>{result.totalFpPlus}</span>
            </div>
            <div className="flex justify-between">
              <span>Total PRMR:</span>
              <span>{formatCurrency(result.totalPrmr)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gross (Rate × PRMR):</span>
              <span>{formatCurrency(result.rate * result.totalPrmr)}</span>
            </div>
            <div className="flex justify-between">
              <span>Rent Bonus:</span>
              <span className="text-green-500">+{formatCurrency(result.rentBonus)}</span>
            </div>
            <div className="flex justify-between">
              <span>Rent Deduction:</span>
              <span className="text-destructive">-{formatCurrency(result.rentDeduction)}</span>
            </div>
          </div>
        </div>

        <PayEstimateDisclaimer className="text-center mt-4" />
      </CardContent>
    </Card>
  );
};
