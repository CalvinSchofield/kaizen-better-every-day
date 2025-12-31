import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush, PushSubscription as WebPushSubscription } from '../_shared/web-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Motivational quotes for 1-hour idle during working hours
const MOTIVATIONAL_QUOTES = [
  "Success is the sum of small efforts repeated day in and day out. Every door matters! 🚪",
  "Champions are made in the moments no one is watching. Get back out there! 💪",
  "The difference between good and great is one more door. You've got this! 🔥",
  "Small actions lead to big results. Each knock builds your future! 🏆",
  "Consistency beats intensity. One more hour can change everything! ⚡",
  "The grind you put in today becomes the success you celebrate tomorrow! 🌟",
  "Your future self will thank you for pushing through right now! 💫",
  "Every door is an opportunity. Don't let this hour slip away! 🎯",
];

// Location coordinates cache for common blitz locations
const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'bakersfield, ca': { lat: 35.3733, lng: -119.0187 },
  'colorado springs, co': { lat: 38.8339, lng: -104.8214 },
  'dallas, tx': { lat: 32.7767, lng: -96.7970 },
  'hollister, ca': { lat: 36.8525, lng: -121.4016 },
  'palmdale, ca': { lat: 34.5794, lng: -118.1165 },
  'fresno, ca': { lat: 36.7378, lng: -119.7871 },
  'sacramento, ca': { lat: 38.5816, lng: -121.4944 },
  'phoenix, az': { lat: 33.4484, lng: -112.0740 },
  'las vegas, nv': { lat: 36.1699, lng: -115.1398 },
  'denver, co': { lat: 39.7392, lng: -104.9903 },
  'austin, tx': { lat: 30.2672, lng: -97.7431 },
  'houston, tx': { lat: 29.7604, lng: -95.3698 },
  'san antonio, tx': { lat: 29.4241, lng: -98.4936 },
  'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
  'san diego, ca': { lat: 32.7157, lng: -117.1611 },
  'salt lake city, ut': { lat: 40.7608, lng: -111.8910 },
  'provo, ut': { lat: 40.2338, lng: -111.6585 },
};

// Default coordinates (California) if location not found
const DEFAULT_COORDS = { lat: 35.3733, lng: -119.0187 };

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface ActiveEntry {
  id: string;
  user_id: string;
  entry_date: string;
  work_start_time: string;
  work_end_time: string | null;
  is_finalized: boolean;
  counter_timestamps: Record<string, string[]>;
  break_periods: Array<{ start: string; end?: string }>;
  timezone: string | null;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
}

interface RepData {
  user_id: string;
  blitz_trip_location: string | null;
  timezone: string | null;
}

// Get local time hour for a timezone
function getLocalHour(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    return new Date().getHours();
  }
}

// Get coordinates for a location
function getCoordinates(location: string | null): { lat: number; lng: number } {
  if (!location) return DEFAULT_COORDS;
  
  const normalized = location.toLowerCase().trim();
  
  // Try exact match first
  if (LOCATION_COORDS[normalized]) {
    return LOCATION_COORDS[normalized];
  }
  
  // Try partial match
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  return DEFAULT_COORDS;
}

// Fetch sunset time from Open-Meteo API
async function getSunsetTime(lat: number, lng: number, timezone: string): Promise<string | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunset&timezone=${encodeURIComponent(timezone)}&forecast_days=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Open-Meteo API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.daily?.sunset?.[0] || null;
  } catch (error) {
    console.error('Error fetching sunset time:', error);
    return null;
  }
}

// Get the latest activity timestamp from counter_timestamps
function getLatestActivityTimestamp(timestamps: Record<string, string[]> | null): Date | null {
  if (!timestamps) return null;
  
  let latest: Date | null = null;
  
  for (const counterTimestamps of Object.values(timestamps)) {
    if (Array.isArray(counterTimestamps)) {
      for (const ts of counterTimestamps) {
        const date = new Date(ts);
        if (!latest || date > latest) {
          latest = date;
        }
      }
    }
  }
  
  return latest;
}

// Check if currently on break
function isOnBreak(breakPeriods: Array<{ start: string; end?: string }> | null): boolean {
  if (!breakPeriods || !Array.isArray(breakPeriods)) return false;
  return breakPeriods.some(bp => bp.start && !bp.end);
}

// Send web push notification using native implementation
async function sendPushNotification(
  subscription: PushSubscription,
  title: string,
  body: string,
  url: string,
  notificationType: string = 'inactivity'
): Promise<boolean> {
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  
  if (!vapidPrivateKey || !vapidPublicKey) {
    console.error('VAPID keys not configured');
    return false;
  }

  const result = await sendWebPush(
    { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
    { title, body, url, type: notificationType },
    vapidPublicKey,
    vapidPrivateKey
  );
  
  if (result.success) {
    console.log(`Push notification sent to user ${subscription.user_id}`);
    return true;
  } else {
    console.error('Error sending push notification:', result.error);
    
    // If subscription is expired/invalid, we should delete it
    if (result.status === 410 || result.status === 404) {
      console.log('Subscription expired, should be cleaned up');
    }
    
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    console.log(`[${now.toISOString()}] Checking for inactive reps...`);
    
    // Get all active (unfinalized) entries for today with work_start_time
    const { data: activeEntries, error: entriesError } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('entry_date', today)
      .eq('is_finalized', false)
      .not('work_start_time', 'is', null);
    
    if (entriesError) {
      throw new Error(`Error fetching entries: ${entriesError.message}`);
    }
    
    if (!activeEntries || activeEntries.length === 0) {
      console.log('No active work sessions found');
      return new Response(JSON.stringify({ message: 'No active sessions', checked: 0, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Found ${activeEntries.length} active entries`);
    
    // Get rep data for locations
    const userIds = activeEntries.map(e => e.user_id);
    const { data: repsData, error: repsError } = await supabase
      .from('reps')
      .select('user_id, blitz_trip_location, timezone')
      .in('user_id', userIds);
    
    if (repsError) {
      console.error('Error fetching reps data:', repsError);
    }
    
    const repsByUserId = new Map<string, RepData>();
    (repsData || []).forEach(rep => {
      repsByUserId.set(rep.user_id, rep);
    });
    
    let notifiedCount = 0;
    
    for (const entry of activeEntries as ActiveEntry[]) {
      // Skip if already has end time (they've ended their session)
      if (entry.work_end_time) {
        console.log(`User ${entry.user_id}: Already has end time, skipping`);
        continue;
      }
      
      // Skip if on break
      if (isOnBreak(entry.break_periods)) {
        console.log(`User ${entry.user_id}: On break, skipping`);
        continue;
      }
      
      // Skip if counters were reset (no meaningful activity - likely not actually working)
      const hasAnyActivity = (entry as any).doors_knocked > 0 || 
        (entry as any).decision_makers > 0 || 
        (entry as any).pitches > 0 || 
        (entry as any).transitions > 0 || 
        (entry as any).presentations > 0 || 
        (entry as any).closes > 0;
      
      if (!hasAnyActivity) {
        console.log(`User ${entry.user_id}: No activity counts (possibly reset), skipping`);
        continue;
      }
      
      // Get rep data for location
      const repData = repsByUserId.get(entry.user_id);
      const timezone = entry.timezone || repData?.timezone || 'America/Los_Angeles';
      
      // Check last activity time
      const lastActivity = getLatestActivityTimestamp(entry.counter_timestamps);
      if (!lastActivity) {
        console.log(`User ${entry.user_id}: No activity timestamps, skipping`);
        continue;
      }
      
      // Get local hour to determine notification type
      // Inactivity notifications work from work_start_time until 9pm local
      const localHour = getLocalHour(timezone);
      const isAfter9pm = localHour >= 21;
      
      // Calculate idle time
      const idleMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      
      // Determine notification type based on time and idle duration
      // After 9pm local: 15 min idle = save day reminder
      // During day (after sunset but before 9pm): 60 min idle = motivational
      const requiredIdleMinutes = isAfter9pm ? 15 : 60;
      
      if (idleMinutes < requiredIdleMinutes) {
        console.log(`User ${entry.user_id}: Only idle ${Math.round(idleMinutes)} min (need ${requiredIdleMinutes}), skipping`);
        continue;
      }
      
      const notificationType = isAfter9pm ? 'inactivity_save' : 'inactivity_motivate';
      
      console.log(`User ${entry.user_id}: Idle ${Math.round(idleMinutes)} min, local hour ${localHour}, type: ${notificationType}`);
      
      // Check if we already sent this type of notification today
      const { data: existingLog } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('user_id', entry.user_id)
        .eq('entry_date', today)
        .eq('notification_type', notificationType)
        .maybeSingle();
      
      if (existingLog) {
        console.log(`User ${entry.user_id}: Already sent ${notificationType} today, skipping`);
        continue;
      }
      
      // Get push subscription
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', entry.user_id);
      
      if (subError || !subscriptions || subscriptions.length === 0) {
        console.log(`User ${entry.user_id}: No push subscription found`);
        continue;
      }
      
      // Compose notification based on type
      let title: string;
      let body: string;
      let url: string;
      
      if (isAfter9pm) {
        // Save day reminder - rich notification with actions
        title = '🌙 Time to Save Your Day!';
        body = `Great work today! Save your progress to lock in your numbers and celebrate your wins.`;
        url = '/track?prompt=save';
      } else {
        // Motivational reminder during working hours
        title = '💪 Keep the Momentum Going!';
        body = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        url = '/track';
      }
      
      // Send notification to all subscriptions
      let sent = false;
      for (const subscription of subscriptions) {
        const success = await sendPushNotification(
          subscription,
          title,
          body,
          url,
          notificationType
        );
        if (success) sent = true;
      }
      
      if (sent) {
        // Log that we sent a notification
        await supabase
          .from('notification_logs')
          .insert({
            user_id: entry.user_id,
            entry_date: today,
            notification_type: notificationType
          });
        
        notifiedCount++;
      }
    }
    
    console.log(`Checked ${activeEntries.length} entries, notified ${notifiedCount} users`);
    
    return new Response(JSON.stringify({ 
      message: 'Check complete', 
      checked: activeEntries.length, 
      notified: notifiedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: unknown) {
    console.error('Error in check-inactivity-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
