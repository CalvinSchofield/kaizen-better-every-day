

## Problem

The `test-push-notification` edge function finds your APNs token but produces **zero logs** after that point — no APNs response, no error. The function has inline APNs code with no logging around the crypto operations or the fetch call, so when something fails (likely the ECDSA signing or the APNs HTTP/2 request), it silently crashes.

## Root Cause

The `test-push-notification` function **duplicates** the APNs sending logic from `send-apns-notification` but strips out all the debug logging. It also doesn't catch/log errors from `crypto.subtle.importKey`, `crypto.subtle.sign`, or the `fetch()` to APNs.

## Fix

**Refactor `test-push-notification` to call `send-apns-notification`** instead of duplicating the APNs logic. This:
1. Reuses the battle-tested, well-logged APNs code
2. Adds visibility into exactly where the failure occurs
3. Eliminates duplicate crypto code that can drift

### Changes

**1. `supabase/functions/test-push-notification/index.ts`**
- Remove the inline APNs JWT + send logic (lines 205-266)
- Instead, call `send-apns-notification` via `supabase.functions.invoke()` for each APNs token
- Add `console.log` for the APNs response so we can see what's happening
- Keep the web push path as-is

**2. Add logging fallback** — If we can't call the other function (circular dependency concerns), instead add the same verbose logging that `send-apns-notification` has:
  - Log before/after `importKey`
  - Log before/after `sign`
  - Log the APNs host being used
  - Log the full APNs response status + body
  - Wrap in try/catch with error logging

The simplest approach: just add `console.log` statements around the existing crypto and fetch calls in the test function, matching what `send-apns-notification` already does. This way we'll see exactly where it fails on the next test.

