

# AI Insights Chat — "Talk to Your Data"

## What We're Building

A full-screen chat interface triggered by the existing sparkle FAB on the Insights page. When opened, it presents a world-class conversational AI experience (think ChatGPT/Gemini-level polish) where reps can ask questions about **their own data** — day-of-week patterns, week-over-week comparisons, time-of-day analysis, funnel breakdowns, pacing, and more. The AI is deeply context-aware about Vivint door-to-door sales, the rep's year/experience level, and adapts its tone accordingly.

## Architecture

```text
┌─────────────────────────────────┐
│  AICoachFab (sparkle button)    │
│  → opens full-screen chat view  │
└────────────┬────────────────────┘
             │ onClick
             ▼
┌─────────────────────────────────┐
│  InsightsChat (full-screen)     │
│  - Message list w/ markdown     │
│  - Suggested prompts on empty   │
│  - Streaming token-by-token     │
│  - Auto-scroll, typing dots     │
└────────────┬────────────────────┘
             │ sends messages + data context
             ▼
┌─────────────────────────────────┐
│  Edge Function: insights-chat   │
│  - Receives conversation msgs   │
│  - Fetches user's full data     │
│    (daily_entries, rep profile,  │
│     official_totals, sales_log)  │
│  - Builds rich system prompt    │
│  - Streams via Lovable AI       │
│  - Returns SSE stream           │
└─────────────────────────────────┘
```

## Key Design Decisions

1. **Data fetched server-side** — The edge function receives the user's auth token, queries their `daily_entries`, `reps` profile, `official_totals`, and `sales_log` data directly from the database. This means the AI has access to ALL their historical data, not just the currently selected date range. No hallucination risk because we feed real numbers.

2. **Rich system prompt** — The edge function constructs a detailed system prompt containing:
   - The rep's name, year (Rookie/Sophomore/Vet), and season goals
   - Complete daily entry data with day-of-week and timestamps
   - Sales log with install statuses, PRMR values, sale types
   - Funnel metrics, ratios, best days/weeks
   - Payscale knowledge (FP+, PRMR, $85 company avg, adders/deductions)
   - Work schedule context (M-F noon-9, Sat 9-9)
   - Year-level expectations (Rookie 100+, Soph 200+, Vet 300+)

3. **Streaming** — Token-by-token SSE streaming for instant feel, exactly like ChatGPT.

4. **Session-only memory** — Messages persist in React state only (no database). Fresh conversation each time. Simple, fast.

## Files to Create

### 1. `supabase/functions/insights-chat/index.ts` — Edge Function
- Authenticates user via JWT from request
- Queries `daily_entries` (all finalized), `reps` profile, `official_totals`, `rep_goals`
- Builds a comprehensive system prompt with all their data formatted as structured text
- Includes Vivint-specific domain knowledge (payscale, adders, metrics definitions)
- Streams response from Lovable AI gateway (`google/gemini-2.5-flash` for speed)
- Handles 429/402 errors gracefully

### 2. `src/components/insights/InsightsChat.tsx` — Full-Screen Chat UI
- Slides up from bottom (full viewport height, covers the insights page)
- Header: back arrow, "AI Coach" title, sparkle icon
- Empty state: 4-6 suggested prompts in pill buttons like:
  - "How am I doing this week vs last?"
  - "What day of the week do I sell best?"
  - "What time of day am I most productive?"
  - "Break down my funnel — where am I losing deals?"
  - "Am I on pace for my season goal?"
  - "Compare my last 2 weeks"
- Message bubbles: user (right, primary color), AI (left, card bg)
- AI messages rendered with `react-markdown` for rich formatting
- Input bar: text input + send button, pinned to bottom with safe-area padding
- Auto-scroll on new messages, typing indicator while streaming

### 3. `src/components/insights/AICoachFab.tsx` — Updated FAB
- Remove the current "Coming Soon" drawer
- Instead, toggle the full-screen `InsightsChat` component
- Pass current insights data context for initial awareness

## Files to Modify

### 4. `src/pages/Insights.tsx`
- Import and render `InsightsChat` as a sibling to the main content
- Pass `isOpen` / `onClose` state managed by the FAB
- The chat overlays the insights page (position fixed, full screen)

### 5. `supabase/config.toml`
- Add `[functions.insights-chat]` with `verify_jwt = false` (auth handled manually in the function)

## System Prompt Design (Key Excerpt)

The system prompt will include domain knowledge like:
- FP+ = New FP count + (Upgrade PRMR / 85)
- EFP = Total PRMR / 85
- Company average PRMR is $85
- Adders: additional monthly revenue items that increase PRMR
- Work schedule: Mon-Fri noon to 8-9pm, Saturday 9-10am to 8-9pm
- Season goals by year: Rookie 100+, Sophomore 200+, Vet 300+
- Funnel stages: Doors → Decision Makers → Pitches → Transitions → Presentations → Closes
- Sales statuses: installed (funded), pending (scheduled), cancelled/never_installed (excluded from metrics)

The prompt will instruct the AI to:
- Only reference the user's actual data — never make up numbers
- Adapt tone based on experience level (encouraging for rookies, analytical for vets)
- Provide specific, actionable insights tied to their numbers
- Reference day-of-week patterns, time-of-day patterns, week-over-week trends
- Understand and correctly calculate all metrics (FP+, EFP, ratios, pace)

## UI Polish Details

- Dark theme consistent with existing app (card backgrounds, border-border/50)
- Smooth slide-up animation (CSS transform)
- Message appear animation (fade + slide up)
- Typing indicator: 3 bouncing dots
- Markdown rendering: bold, lists, code blocks styled to match theme
- Safe area insets for iOS/TestFlight
- Input focuses keyboard properly on mobile

