-- Schedule job-scanner Edge Function every hour at :05
-- Requires pg_cron and pg_net extensions (both pre-installed on Supabase)
select cron.schedule(
  'job-scanner-hourly',
  '5 * * * *',
  $$
  select extensions.net.http_post(
    url    := 'https://whrzgnleryhptaqorqtb.supabase.co/functions/v1/job-scanner',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocnpnbmxlcnlocHRhcW9ycXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDM4MDgsImV4cCI6MjA5NzkxOTgwOH0.5wbBRFOjp1F2N5ItlNIDPWU4YhE_RpJgqaGnkqyb4rA"}'::jsonb,
    body   := '{}'::jsonb
  ) as request_id;
  $$
);
