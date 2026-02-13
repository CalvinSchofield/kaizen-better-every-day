

# Redesign Upgrade PRMR Calculator

## Overview
Replace the current chat-first calculator drawer with a package-builder-style visual equipment selector that calculates PRMR in real-time, with the chat as an optional secondary mode. The new design will be used in two places:
1. The `/tools/upgrades` page (via "Calculate Upgrade PRMR" button)
2. The log-sale page (via the "?" helper when sale type is upgrade)

## Current Problems
- The current calculator is chat-centric -- users must either use tiny pill-style quick-select buttons or type equipment into a chat
- Quick select lacks product images, making it hard to identify items quickly
- No real-time PRMR calculation -- users must press "Calculate PRMR" and wait for AI response
- The chat approach is slow and error-prone for a simple arithmetic operation

## Design Approach

### Two-Tab Layout Inside the Drawer
A segmented control at the top switches between:
- **Builder** (default) -- visual equipment cards with real-time PRMR, matching the package builder pattern
- **Chat** -- the existing AI chat for reps who prefer typing

### Builder Tab (Primary)
Reuses the existing `UpgradeEquipmentConfigurator` and `UpgradePriceSummary` components from the package builder (`src/components/tools/package-builder/upgrade/`). This gives users:
- Product images in rounded cards with +/- buttons
- Categories: Cameras, Smart Home, Security
- Video fee (new camera) controls on camera cards
- Panel toggle
- Real-time PRMR calculation in a sticky bottom summary bar

The sticky bottom bar shows:
- PRMR value (prominent, green)
- Monthly added amount
- Expandable breakdown
- A "Use this PRMR" button (when triggered from log-sale)

### Chat Tab (Secondary)
Keeps the existing chat functionality as-is for reps who prefer to type their equipment list.

## Technical Plan

### 1. Create New Component: `src/components/UpgradePrmrCalculatorV2.tsx`
A new Drawer component with two tabs:

**Builder tab:**
- Reuses `UpgradeEquipmentConfigurator` for the equipment cards
- Reuses the PRMR calculation logic from `PackageBuilder.tsx` (the `upgradePrices` useMemo)
- Panel toggle
- Sticky bottom bar with real-time PRMR + "Use PRMR" CTA when `onPrmrCalculated` is provided

**Chat tab:**
- Embeds the existing chat logic (messages, sendMessageToAPI, etc.) from the current `UpgradePrmrCalculator`

Props remain the same:
```
interface UpgradePrmrCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrmrCalculated?: (prmr: number) => void;
}
```

### 2. Replace Old Calculator References
Update these files to import the new V2 component:
- `src/pages/LogSale.tsx` -- swap `UpgradePrmrCalculator` import
- `src/components/LogSaleSheet.tsx` -- swap import
- `src/pages/UpgradeCheatSheet.tsx` -- swap import

### 3. Delete Old Component
Remove `src/components/UpgradePrmrCalculator.tsx` after migration.

## Key Details

### PRMR Calculation (deterministic, no AI needed for builder mode)
```
Equipment Total (no install fee, no tax) / 60 + (new camera count x $5)
```
This matches the edge function logic exactly. The builder does this client-side in real-time.

### Equipment List
Reuses `UPGRADE_EQUIPMENT_LIST` from `upgradeTypes.ts` -- same items with product images already defined.

### Video Fee / New Camera Logic
- Indoor cameras: always count as new (auto $5/mo each)
- Doorbell and Outdoor: user toggles how many are "new" via the existing `UpgradeEquipmentCard` new-cam sub-control
- Spotlights: no video fee

### Layout Structure (Builder Tab)
```text
+----------------------------------+
|  [Builder]  [Chat]   (tabs)      |
+----------------------------------+
|  Panel toggle                    |
+----------------------------------+
|  Cameras (horizontal scroll)     |
|  [Doorbell] [Outdoor] [Indoor].. |
+----------------------------------+
|  Smart Home                      |
|  [Lock] [Thermostat] [Garage]    |
+----------------------------------+
|  Security                        |
|  [Door/Window] [Motion] [Glass]  |
+----------------------------------+
|                                  |
+----------------------------------+
| PRMR: $XX  |  +$XX.XX/mo        |
| [Use $XX.XX PRMR]               |
+----------------------------------+
```

### Files Changed
| File | Change |
|------|--------|
| `src/components/UpgradePrmrCalculatorV2.tsx` | New -- builder + chat tabs |
| `src/components/UpgradePrmrCalculator.tsx` | Delete |
| `src/pages/LogSale.tsx` | Update import |
| `src/components/LogSaleSheet.tsx` | Update import |
| `src/pages/UpgradeCheatSheet.tsx` | Update import |

No database changes. No new dependencies. All calculation logic is client-side for the builder; the edge function is only used for the chat tab.

