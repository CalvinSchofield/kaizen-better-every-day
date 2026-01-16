-- Schedule auto-finalize-entries to run every hour at minute :05
-- This catches entries across all timezones as they pass midnight
SELECT cron.schedule(
  'auto-finalize-entries-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wjxlzcuqpoamrwumszau.supabase.co/functions/v1/auto-finalize-entries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeGx6Y3VxcG9hbXJ3dW1zemF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDI0OTgsImV4cCI6MjA3OTY3ODQ5OH0.eBQbIe6CoALiFyiN6qlSq6MaR2NPE_OCBvhmGKqB8FI'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);