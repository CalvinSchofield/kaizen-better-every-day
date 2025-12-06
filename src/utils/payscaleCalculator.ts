// Payscale tiers based on FP+ thresholds
const PAYSCALE_TIERS = [
  { min: 0, max: 19, rate: 5.76, rentBonus: 0 },
  { min: 20, max: 39, rate: 6.41, rentBonus: 0 },
  { min: 40, max: 59, rate: 6.88, rentBonus: 0 },
  { min: 60, max: 79, rate: 7.41, rentBonus: 3250 },
  { min: 80, max: 99, rate: 7.88, rentBonus: 3250 },
  { min: 100, max: 119, rate: 8.47, rentBonus: 3250 },
  { min: 120, max: 139, rate: 8.71, rentBonus: 3250 },
  { min: 140, max: 159, rate: 8.94, rentBonus: 3250 },
  { min: 160, max: 199, rate: 9.18, rentBonus: 3250 },
  { min: 200, max: 219, rate: 9.65, rentBonus: 5000 },
  { min: 220, max: 239, rate: 9.88, rentBonus: 5000 },
  { min: 240, max: 259, rate: 10.12, rentBonus: 5000 },
  { min: 260, max: 299, rate: 10.35, rentBonus: 5000 },
  { min: 300, max: Infinity, rate: 10.59, rentBonus: 5000 },
];

// Rent costs per week by type
const RENT_PER_WEEK: Record<string, number> = {
  'Single': 200,
  'Married': 275,
  'Married+': 350,
  'None': 0,
};

export interface PayscaleInputs {
  fpGoal: number;
  avgPrmrPerFp?: number; // Default 85
  upgradeFpGoal?: number; // Default 0
  rentType?: string; // Default 'Single'
  weeksWorking?: number; // Default 18
}

export interface PayscaleResult {
  totalFpPlus: number;
  totalPrmr: number;
  rate: number;
  rentBonus: number;
  rentDeduction: number;
  takeHomePay: number;
  tier: typeof PAYSCALE_TIERS[0];
}

export interface ReversePayscaleInputs {
  targetEarnings: number;
  avgPrmrPerFp?: number;
  upgradeFpGoal?: number;
  rentType?: string;
  weeksWorking?: number;
}

// Get tier based on total FP+
export function getTier(totalFpPlus: number): typeof PAYSCALE_TIERS[0] {
  return PAYSCALE_TIERS.find(
    (tier) => totalFpPlus >= tier.min && totalFpPlus <= tier.max
  ) || PAYSCALE_TIERS[PAYSCALE_TIERS.length - 1];
}

// Forward calculation: FP+ goal → Take-Home Pay
export function calculateTakeHome(inputs: PayscaleInputs): PayscaleResult {
  const {
    fpGoal,
    avgPrmrPerFp = 85,
    upgradeFpGoal = 0,
    rentType = 'Single',
    weeksWorking = 18,
  } = inputs;

  // Calculate total FP+ (FP count + upgrade FP+)
  const totalFpPlus = fpGoal + upgradeFpGoal;

  // Calculate total PRMR
  // FP PRMR = FP count × avg PRMR per FP
  // Upgrade PRMR = upgrade FP+ × 85 (fixed rate)
  const totalPrmr = (fpGoal * avgPrmrPerFp) + (upgradeFpGoal * 85);

  // Get tier based on total FP+
  const tier = getTier(totalFpPlus);
  const { rate, rentBonus } = tier;

  // Calculate rent deduction
  const rentPerWeek = RENT_PER_WEEK[rentType] || RENT_PER_WEEK['Single'];
  const rentDeduction = weeksWorking * rentPerWeek;

  // Calculate take-home pay
  const takeHomePay = (rate * totalPrmr) + rentBonus - rentDeduction;

  return {
    totalFpPlus,
    totalPrmr,
    rate,
    rentBonus,
    rentDeduction,
    takeHomePay: Math.round(takeHomePay),
    tier,
  };
}

// Reverse calculation: Target earnings → Required FP+ goal
export function calculateRequiredFp(inputs: ReversePayscaleInputs): number {
  const {
    targetEarnings,
    avgPrmrPerFp = 85,
    upgradeFpGoal = 0,
    rentType = 'Single',
    weeksWorking = 18,
  } = inputs;

  // Calculate rent deduction (fixed regardless of FP+)
  const rentPerWeek = RENT_PER_WEEK[rentType] || RENT_PER_WEEK['Single'];
  const rentDeduction = weeksWorking * rentPerWeek;

  // We need to find FP goal where:
  // takeHome = (rate × totalPrmr) + rentBonus - rentDeduction
  // targetEarnings = (rate × ((fpGoal × avgPrmrPerFp) + (upgradeFpGoal × 85))) + rentBonus - rentDeduction

  // Since rate and rentBonus depend on tier (which depends on fpGoal), 
  // we iterate through tiers to find the right one
  for (let fpGoal = 0; fpGoal <= 500; fpGoal++) {
    const result = calculateTakeHome({
      fpGoal,
      avgPrmrPerFp,
      upgradeFpGoal,
      rentType,
      weeksWorking,
    });

    if (result.takeHomePay >= targetEarnings) {
      return fpGoal;
    }
  }

  // If target is extremely high, return max checked
  return 500;
}

// Calculate "Must Do" goal from expenses
export function calculateMustDoFromExpenses(
  monthlyExpenses: number,
  monthsOff: number = 4,
  avgPrmrPerFp: number = 85,
  rentType: string = 'Single',
  weeksWorking: number = 18
): number {
  const targetEarnings = monthlyExpenses * monthsOff;
  return calculateRequiredFp({
    targetEarnings,
    avgPrmrPerFp,
    rentType,
    weeksWorking,
  });
}

// Get all tiers for display
export function getAllTiers() {
  return PAYSCALE_TIERS;
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Get rent types for dropdown
export function getRentTypes(): string[] {
  return Object.keys(RENT_PER_WEEK);
}

// Get rent cost for display
export function getRentCost(rentType: string, weeksWorking: number = 18): number {
  const rentPerWeek = RENT_PER_WEEK[rentType] || RENT_PER_WEEK['Single'];
  return rentPerWeek * weeksWorking;
}
