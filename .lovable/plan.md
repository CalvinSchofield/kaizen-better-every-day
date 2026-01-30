
# Enhance CatchUpWizard with EFP Mode + Proper Curator Guidance

## Overview

Update the CatchUpWizard to:
1. **Support EFP Mode**: Show "EFP" instead of "FP+" for veterans with EFP mode enabled
2. **Fix the help link**: Point to Curator production report instead of vivint.com
3. **Add explicit guidance**: Make it clear users need TOTAL sold (funded + unfunded)

---

## Technical Changes

### File: `src/components/catchup/CatchUpWizard.tsx`

#### 1. Use EFP mode properly in the component

**Current (line 45):**
```typescript
const { calculateEfp } = useEfpMode();
```

**Updated:**
```typescript
const { efpModeEnabled, calculateEfp } = useEfpMode();
const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
```

#### 2. Add Curator URL constants (after imports)

```typescript
// External URLs for guidance
const CURATOR_PRODUCTION_URL = 'https://curator.vivint.com/dashboard/production-test-production-report';
const SOURCE_EARNINGS_URL = 'https://curator.vivint.com/dashboard/source-accountdetailsearnings?';
```

#### 3. Update the 'fp' step with dynamic labels and proper guidance

**Current (lines 120-149):**
```tsx
case 'fp':
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">How many FP+ have you sold?</h3>
        <p className="text-sm text-muted-foreground">
          Check your Vivint app for your exact {seasonType} FP+ total
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fp-input">Total FP+</Label>
        <Input ... />
      </div>
      <button 
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => window.open('https://www.vivint.com', '_blank')}
      >
        <HelpCircle className="h-4 w-4" />
        Where do I find this?
      </button>
    </div>
  );
```

**Updated:**
```tsx
case 'fp':
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">
          {efpModeEnabled 
            ? "What's your total EFP sold?" 
            : "How many FP+ have you sold?"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter your <strong>TOTAL</strong> {seasonType} {metricLabel} — both funded AND unfunded
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fp-input">Total {metricLabel} Sold</Label>
        <Input
          id="fp-input"
          type="number"
          inputMode="decimal"
          placeholder={efpModeEnabled ? "e.g., 62.9" : "e.g., 12.5"}
          value={fpPlus}
          onChange={(e) => setFpPlus(e.target.value)}
          className="text-2xl h-14 text-center"
          autoFocus
        />
      </div>
      
      {/* Guidance card for finding the number */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 space-y-3">
          <button 
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline w-full"
            onClick={() => window.open(CURATOR_PRODUCTION_URL, '_blank')}
          >
            <HelpCircle className="h-4 w-4" />
            Where do I find this?
            <ExternalLink className="h-3 w-3 ml-auto" />
          </button>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside pl-1">
            <li>Open the <strong>Production Report</strong> on Curator</li>
            <li>Change "Funded" dropdown to <strong>"(All)"</strong></li>
            <li>Find your <strong>total {metricLabel}</strong> (includes unfunded)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
```

#### 4. Update PRMR step for EFP mode users

**Current title (line 156):**
```tsx
<h3 className="text-lg font-semibold">What's your total PRMR?</h3>
```

**Updated:**
```tsx
<h3 className="text-lg font-semibold">
  {efpModeEnabled ? "Confirm your total PRMR" : "What's your total PRMR?"}
</h3>
<p className="text-sm text-muted-foreground">
  {efpModeEnabled 
    ? "We'll calculate your EFP from this (PRMR ÷ 85)"
    : "This helps us calculate your EFP and income projections"}
</p>
```

#### 5. Update confirmation step to be EFP-mode aware

**Current (lines 230-253):**
```tsx
<div className="flex justify-between items-center">
  <span className="text-muted-foreground">FP+</span>
  <span className="text-xl font-semibold">{fpValue.toFixed(1)}</span>
</div>
// ... shows both FP+ and EFP
```

**Updated:**
- For EFP mode: Show EFP as the primary metric
- For FP+ mode: Show FP+ as the primary metric
- Always show PRMR for context

```tsx
{efpModeEnabled ? (
  <>
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">EFP (Total Sold)</span>
      <span className="text-xl font-semibold">{fpValue.toFixed(2)}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">PRMR</span>
      <span className="text-xl font-semibold">${prmrValue.toFixed(0)}</span>
    </div>
  </>
) : (
  <>
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">FP+ (Total Sold)</span>
      <span className="text-xl font-semibold">{fpValue.toFixed(1)}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">PRMR</span>
      <span className="text-xl font-semibold">${prmrValue.toFixed(0)}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">EFP</span>
      <span className="text-xl font-semibold">{efpValue.toFixed(2)}</span>
    </div>
  </>
)}
```

#### 6. Update imports

Add `ExternalLink` to the lucide-react imports.

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Metric Label** | Always "FP+" | "EFP" for vets with EFP mode, "FP+" otherwise |
| **Help Link** | `vivint.com` (useless) | Curator Production Report with step-by-step guidance |
| **Guidance** | "Check your Vivint app" | Explicit: "TOTAL sold - funded AND unfunded" + numbered steps |
| **Confirm Screen** | Shows FP+/PRMR/EFP always | EFP mode: Shows EFP primary; FP+ mode: Shows FP+ primary |

---

## User Experience Flow

**For EFP Mode Veterans:**
1. "What's your total EFP sold?"
2. Clear instruction: "Enter your TOTAL (funded + unfunded)"
3. Link opens Curator → instructions to set filter to "(All)"
4. Confirmation shows EFP as primary metric

**For FP+ Mode Reps:**
1. "How many FP+ have you sold?"
2. Same clear guidance about total sold
3. Same Curator link with instructions
4. Confirmation shows FP+ as primary, EFP as derived

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/catchup/CatchUpWizard.tsx` | Add EFP mode support, Curator URL, step-by-step guidance |
