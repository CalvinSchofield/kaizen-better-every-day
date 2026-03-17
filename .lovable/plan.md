

# Fix: Calendar "Add Sale" Saves to Wrong Date

## The Bug
When a user taps a past day in the calendar drawer and hits "Add a Sale or Referral", the sale always gets added to **today** instead of the selected day.

**Root cause:** `CalendarDayDrawer` navigates using query params (`/log-sale?date=2025-03-16&from=calendar`), but `LogSale` only reads from `location.state`. Since state is empty:
- `showDatePicker` = false (date picker hidden)
- `returnPath` = `/track` (not calendar)
- No `entryDate` is passed back on submit
- `TrackWithLayout` receives the sale and adds it to today's entry

## The Fix

### 1. CalendarDayDrawer — pass navigation state instead of query params
Change `handleAddSale` to use `navigate('/log-sale', { state: { ... } })` with:
- `showDatePicker: true` (show date picker, pre-filled to the selected day)
- `returnPath: '/calendar'` (go back to calendar, not track)
- The selected date pre-set

### 2. LogSale — initialize `selectedDate` from query params as fallback
Read the `date` search param and use it to initialize `selectedDate` if present. Also detect `from=calendar` to set `showDatePicker=true` and `returnPath='/calendar'` as fallbacks when no state is provided.

### 3. Calendar page — handle returned sale data with `useAddSaleToEntry`
When LogSale navigates back to `/calendar` with `saleLogged + entryDate + saleData`, the Calendar page needs to intercept that state and use `useAddSaleToEntry` to save the sale to the correct date's entry.

## Files Changed
- `src/components/CalendarDayDrawer.tsx` — pass state instead of query params
- `src/pages/LogSale.tsx` — read query params as fallback for state
- `src/pages/Calendar.tsx` — handle returned sale data and save to correct date

