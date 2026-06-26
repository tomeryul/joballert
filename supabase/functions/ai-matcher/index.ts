import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Mirror of the client-side matcher for server-side use
function matchScore(job: any, profile: any): number {
  const userSkills = (profile.skills || []).map((s: string) => s.toLowerCase());
  const jobSkills = (job.skills || []).map((s: string) => s.toLowerCase());

  let skillScore = 0.7;
  if (jobSkills.length > 0) {
    const matched = jobSkills.filter((s: string) => userSkills.includes(s)).length;
    skillScore = matched / jobSkills.length;
  }

  const jobLevel = job.experience_level || 'unknown';
  const userLevels = profile.experience_levels || ['junior', 'mid'];
  const levelScore = jobLevel === 'unknown' ? 0.7 : userLevels.includes(jobLevel) ? 1 : 0.4;

  const remoteScore = profile.remote_preference === 'any' ? 0.9
    : profile.remote_preference === job.remote_type ? 1 : 0.5;

  return Math.min(100, Math.round(
    skillScore * 40 + levelScore * 20 + remoteScore * 15 + 25
  ));
}

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const { user_id, job_ids } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    const { data: jobs } = await supabase
      .from('jobs')
      .select('*')
      .in('id', job_ids || [])
      .eq('is_active', true);

    const scores: Record<string, number> = {};
    for (const job of (jobs || [])) {
      scores[job.id] = matchScore(job, profile || {});
    }

    return new Response(JSON.stringify({ success: true, scores }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers,
    });
  }
});
