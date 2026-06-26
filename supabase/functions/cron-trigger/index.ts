// Cron Trigger — called by pg_cron or external scheduler every hour
// Invokes the job-scanner function
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    // Trigger job scanner
    const scanRes = await fetch(`${supabaseUrl}/functions/v1/job-scanner`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(120000),
    });

    const scanData = await scanRes.json();

    // After scanning, find users with notifications enabled
    // and notify them of high-match new jobs
    if (scanData.totalNew > 0) {
      const { data: newJobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .gte('created_at', new Date(Date.now() - 70 * 60000).toISOString()) // last 70 min
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: users } = await supabase
        .from('user_settings')
        .select('user_id, min_match_score, notify_new_jobs, push_enabled, email_enabled')
        .eq('notify_new_jobs', true);

      for (const user of (users || [])) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('skills, experience_levels, remote_preference')
          .eq('id', user.user_id)
          .single();

        const minScore = user.min_match_score || 60;

        for (const job of (newJobs || [])) {
          // Simple score estimate for notification gate
          const userSkills = (profile?.skills || []).map((s: string) => s.toLowerCase());
          const jobSkills = (job.skills || []).map((s: string) => s.toLowerCase());
          const matched = jobSkills.filter((s: string) => userSkills.includes(s)).length;
          const score = jobSkills.length > 0
            ? Math.min(100, Math.round(matched / jobSkills.length * 40 + 35))
            : 55;

          if (score >= minScore) {
            await supabase.from('notifications').insert({
              user_id: user.user_id,
              job_id: job.id,
              type: 'new_job',
              title: `New match: ${job.title}`,
              body: `${job.company_name} — ${score}% match`,
              action_url: `/jobs.html?id=${job.id}`,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, scan: scanData }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers,
    });
  }
});
