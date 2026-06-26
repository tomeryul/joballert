import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const KEYWORDS = ['software', 'developer', 'engineer', 'frontend', 'backend', 'full stack', 'fullstack'];

const GREENHOUSE_COMPANIES = [
  { slug: 'databricks', name: 'Databricks' },
  { slug: 'figma', name: 'Figma' },
  { slug: 'notion', name: 'Notion' },
  { slug: 'ramp', name: 'Ramp' },
  { slug: 'retool', name: 'Retool' },
  { slug: 'asana', name: 'Asana' },
  { slug: 'brex', name: 'Brex' },
  { slug: 'gusto', name: 'Gusto' },
  { slug: 'plaid', name: 'Plaid' },
  { slug: 'intercom', name: 'Intercom' },
  { slug: 'benchling', name: 'Benchling' },
  { slug: 'mixpanel', name: 'Mixpanel' },
];

const LEVER_COMPANIES = [
  { slug: 'reddit', name: 'Reddit' },
  { slug: 'canva', name: 'Canva' },
  { slug: 'discord', name: 'Discord' },
  { slug: 'duolingo', name: 'Duolingo' },
  { slug: 'airtable', name: 'Airtable' },
  { slug: 'dropbox', name: 'Dropbox' },
  { slug: 'calm', name: 'Calm' },
  { slug: 'faire', name: 'Faire' },
];

// ── Helpers ───────────────────────────────

function cleanText(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 8000);
}

function detectRemote(text: string): string {
  const t = text.toLowerCase();
  if (/\bremote\b/.test(t)) return 'remote';
  if (/\bhybrid\b/.test(t)) return 'hybrid';
  if (/\bonsite\b|\bon-site\b|\bin.?office\b/.test(t)) return 'onsite';
  return 'unknown';
}

function detectLevel(title: string): string {
  const t = (title || '').toLowerCase();
  if (/\b(senior|sr\.?|staff|iii|iv)\b/.test(t)) return 'senior';
  if (/\b(lead|principal|architect|director)\b/.test(t)) return 'lead';
  if (/\b(junior|jr\.?|associate|entry.?level|graduate|new.?grad)\b/.test(t)) return 'junior';
  if (/\b(intern|internship)\b/.test(t)) return 'intern';
  if (/\b(mid|ii|middle)\b/.test(t)) return 'mid';
  return 'unknown';
}

function extractSkills(text: string): string[] {
  const SKILLS = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust',
    'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express', 'Django', 'Spring',
    'FastAPI', 'Rails',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQL',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'HTML', 'CSS', 'Sass', 'Tailwind', 'GraphQL', 'REST', 'gRPC', 'Git', 'Linux',
  ];
  const lower = text.toLowerCase();
  return SKILLS.filter(s =>
    new RegExp(`\\b${s.replace(/[+#.]/g, '\\$&')}\\b`, 'i').test(lower)
  );
}

function matchesKeywords(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some(kw => t.includes(kw));
}

// ── Greenhouse ────────────────────────────

async function fetchGreenhouseJobs(slug: string, companyName: string) {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || [])
      .filter((j: any) => matchesKeywords(j.title + ' ' + (j.content || '')))
      .map((j: any) => ({
        title: cleanText(j.title),
        company_name: companyName,
        location: j.location?.name || null,
        remote_type: detectRemote((j.location?.name || '') + ' ' + (j.content || '')),
        url: j.absolute_url,
        description: cleanText(j.content || ''),
        skills: extractSkills(j.title + ' ' + (j.content || '')),
        experience_level: detectLevel(j.title),
        job_type: 'fulltime',
        date_posted: j.updated_at || new Date().toISOString(),
        source: 'greenhouse',
        source_id: String(j.id),
        is_active: true,
      }))
      .filter((j: any) => j.url && j.title);
  } catch {
    return [];
  }
}

// ── Lever ─────────────────────────────────

async function fetchLeverJobs(slug: string, companyName: string) {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${slug}?mode=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const jobs = await res.json();
    return (Array.isArray(jobs) ? jobs : [])
      .filter((j: any) => matchesKeywords(j.text + ' ' + (j.descriptionPlain || '')))
      .map((j: any) => ({
        title: cleanText(j.text),
        company_name: companyName,
        location: j.categories?.location || null,
        remote_type: detectRemote((j.categories?.location || '') + ' ' + (j.text || '')),
        url: j.hostedUrl,
        description: cleanText(j.descriptionPlain || ''),
        skills: extractSkills(j.text + ' ' + (j.descriptionPlain || '')),
        experience_level: detectLevel(j.text),
        job_type: 'fulltime',
        date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
        source: 'lever',
        source_id: j.id,
        is_active: true,
      }))
      .filter((j: any) => j.url && j.title);
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────

async function runScan() {
  const results: Record<string, { found: number; inserted: number }> = {};
  let totalNew = 0;

  // Log start
  const { data: scanLog } = await supabase
    .from('scan_logs')
    .insert({ provider: 'all', status: 'running' })
    .select()
    .single();

  // Greenhouse
  const ghJobs: any[] = [];
  for (const co of GREENHOUSE_COMPANIES) {
    const jobs = await fetchGreenhouseJobs(co.slug, co.name);
    ghJobs.push(...jobs);
    await new Promise(r => setTimeout(r, 250));
  }
  if (ghJobs.length) {
    const { data } = await supabase
      .from('jobs')
      .upsert(ghJobs, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    results.greenhouse = { found: ghJobs.length, inserted: data?.length || 0 };
    totalNew += data?.length || 0;
  }

  // Lever
  const lvJobs: any[] = [];
  for (const co of LEVER_COMPANIES) {
    const jobs = await fetchLeverJobs(co.slug, co.name);
    lvJobs.push(...jobs);
    await new Promise(r => setTimeout(r, 250));
  }
  if (lvJobs.length) {
    const { data } = await supabase
      .from('jobs')
      .upsert(lvJobs, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    results.lever = { found: lvJobs.length, inserted: data?.length || 0 };
    totalNew += data?.length || 0;
  }

  // Mark old jobs inactive (not seen in 30 days)
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  await supabase
    .from('jobs')
    .update({ is_active: false })
    .lt('updated_at', cutoff)
    .eq('is_active', true);

  // Finalize log
  if (scanLog) {
    await supabase.from('scan_logs').update({
      status: 'success',
      jobs_found: ghJobs.length + lvJobs.length,
      jobs_new: totalNew,
      completed_at: new Date().toISOString(),
    }).eq('id', scanLog.id);
  }

  return { results, totalNew };
}

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const data = await runScan();
    return new Response(JSON.stringify({ success: true, ...data }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers,
    });
  }
});
