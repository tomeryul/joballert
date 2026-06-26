import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,apikey',
};

// ── Israel location filter ────────────────
const IL_RE = /israel|tel[- ]?aviv|jerusalem|haifa|herzliya|ramat[- ]?gan|be.?er[- ]?sheva|petah[- ]?tikva|ra.?anana|rehovot|netanya|bnei[- ]?brak|holon|modiin|ashdod|ashkelon|eilat/i;
function isIsraeli(loc: string): boolean { return IL_RE.test(loc); }

// ── Text helpers ──────────────────────────
function clean(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}
function remote(text: string): string {
  const t = text.toLowerCase();
  if (/\bremote\b/.test(t)) return 'remote';
  if (/\bhybrid\b/.test(t)) return 'hybrid';
  if (/\bon.?site\b|\bin.?office\b/.test(t)) return 'onsite';
  return 'unknown';
}
function level(text: string): string {
  const t = (text || '').toLowerCase();
  if (/\b(senior|sr\.?|staff|iii|iv)\b/.test(t)) return 'senior';
  if (/\b(lead|principal|architect)\b/.test(t)) return 'lead';
  if (/\b(junior|jr\.?|associate|entry.?level|graduate|new.?grad)\b/.test(t)) return 'junior';
  if (/\b(intern|internship)\b/.test(t)) return 'intern';
  if (/\b(mid|ii|middle)\b/.test(t)) return 'mid';
  return 'unknown';
}
function skills(text: string): string[] {
  const KNOWN = ['JavaScript','TypeScript','Python','Java','C++','C#','Ruby','Go','Rust',
    'React','Vue','Angular','Next.js','Node.js','Express','Django','Spring','FastAPI',
    'PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','SQL',
    'AWS','GCP','Azure','Docker','Kubernetes','Terraform',
    'HTML','CSS','Tailwind','GraphQL','REST','Git','Linux'];
  return KNOWN.filter(s =>
    new RegExp(`\\b${s.replace(/[+#.]/g,'\\$&')}\\b`, 'i').test(text)
  );
}
function devJob(text: string): boolean {
  return /developer|engineer|software|backend|frontend|fullstack|full.?stack|devops|data.?sci|qa|sre|site.?reli|architect|מפתח|תוכנה/i.test(text);
}

// ── DRUSHIM RSS ───────────────────────────
async function fetchDrushim(): Promise<any[]> {
  const feeds = [
    'https://www.drushim.co.il/rss/cat4/',
    'https://www.drushim.co.il/rss/cat4/?q=%D7%9E%D7%A4%D7%AA%D7%97',
    'https://www.drushim.co.il/rss/cat4/?q=developer',
    'https://www.drushim.co.il/rss/cat4/?q=software',
    'https://www.drushim.co.il/rss/cat4/?q=fullstack',
    'https://www.drushim.co.il/rss/cat4/?q=backend',
    'https://www.drushim.co.il/rss/cat4/?q=frontend',
  ];

  const seen = new Set<string>();
  const jobs: any[] = [];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed, {
        headers: { 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const xml = await res.text();

      // Extract <item> blocks
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const [, body] of items) {
        const rawTitle = (body.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
        const link     = (body.match(/<link>\s*(https?:[^\s<]+)\s*<\/link>/) || [])[1]?.trim() || '';
        const desc     = (body.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
        const pub      = (body.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || '';

        if (!link || seen.has(link)) continue;
        seen.add(link);

        // Parse "Title - Company" or "Title | Company"
        let title = rawTitle, company = '';
        for (const sep of [' - ', ' – ', ' | ', ' — ']) {
          const idx = rawTitle.lastIndexOf(sep);
          if (idx > 2) { title = rawTitle.slice(0, idx).trim(); company = rawTitle.slice(idx + sep.length).trim(); break; }
        }
        if (!devJob(title + ' ' + clean(desc))) continue;

        jobs.push({
          title,
          company_name: company || 'Unknown',
          location: 'Israel',
          url: link,
          description: clean(desc),
          skills: skills(title + ' ' + clean(desc)),
          remote_type: remote(clean(desc) + ' ' + title),
          experience_level: level(title + ' ' + clean(desc)),
          job_type: 'fulltime',
          date_posted: pub ? new Date(pub).toISOString() : new Date().toISOString(),
          source: 'drushim',
          is_active: true,
        });
      }
    } catch (e) {
      console.warn('drushim feed error:', e);
    }
  }
  return jobs;
}

// ── LINKEDIN guest API ────────────────────
async function fetchLinkedIn(): Promise<any[]> {
  const searches = [
    'software developer Israel',
    'backend developer Israel',
    'fullstack developer Israel',
    'frontend developer Israel',
    'software engineer Israel',
  ];
  const seen = new Set<string>();
  const jobs: any[] = [];

  for (const kw of searches) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(kw)}&location=Israel&geoId=101620260&f_TPR=r604800&start=0&count=25`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract titles
      const titles    = [...html.matchAll(/class="base-search-card__title"[^>]*>\s*([^<]+)\s*<\/h3>/g)].map(m => m[1].trim());
      const companies = [...html.matchAll(/class="base-search-card__subtitle"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim());
      const locs      = [...html.matchAll(/class="job-search-card__location"[^>]*>([^<]+)<\/span>/g)].map(m => m[1].trim());
      const urls      = [...html.matchAll(/href="(https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[^?"]+)"/g)].map(m => m[1]);
      const dates     = [...html.matchAll(/datetime="(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]);

      for (let i = 0; i < titles.length; i++) {
        const jobUrl = urls[i];
        if (!jobUrl || seen.has(jobUrl)) continue;
        seen.add(jobUrl);
        const loc = locs[i] || 'Israel';
        jobs.push({
          title: titles[i],
          company_name: companies[i] || 'Unknown',
          location: loc,
          url: jobUrl,
          description: '',
          skills: skills(titles[i]),
          remote_type: remote(loc + ' ' + titles[i]),
          experience_level: level(titles[i]),
          job_type: 'fulltime',
          date_posted: dates[i] ? new Date(dates[i]).toISOString() : new Date().toISOString(),
          source: 'linkedin',
          is_active: true,
        });
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.warn('linkedin error:', e);
    }
  }
  return jobs;
}

// ── GREENHOUSE (Israeli companies) ────────
const GH_COMPANIES = [
  { slug: 'monday',    name: 'monday.com' },
  { slug: 'fiverr',    name: 'Fiverr' },
  { slug: 'jfrog',     name: 'JFrog' },
  { slug: 'cyberark',  name: 'CyberArk' },
  { slug: 'taboola',   name: 'Taboola' },
  { slug: 'outbrain',  name: 'Outbrain' },
  { slug: 'snyk',      name: 'Snyk' },
  { slug: 'payoneer',  name: 'Payoneer' },
  { slug: 'walkme',    name: 'WalkMe' },
  { slug: 'bigid',     name: 'BigID' },
  { slug: 'radware',   name: 'Radware' },
  { slug: 'imperva',   name: 'Imperva' },
  { slug: 'amdocs',    name: 'Amdocs' },
];

async function fetchGreenhouse(): Promise<any[]> {
  const jobs: any[] = [];
  for (const co of GH_COMPANIES) {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${co.slug}/jobs?content=true`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of (data.jobs || [])) {
        const loc = j.location?.name || '';
        if (!isIsraeli(loc)) continue;
        if (!devJob(j.title + ' ' + (j.content || ''))) continue;
        jobs.push({
          title: clean(j.title),
          company_name: co.name,
          location: loc,
          url: j.absolute_url,
          description: clean(j.content || ''),
          skills: skills(j.title + ' ' + (j.content || '')),
          remote_type: remote(loc + ' ' + (j.content || '')),
          experience_level: level(j.title),
          job_type: 'fulltime',
          date_posted: j.updated_at || new Date().toISOString(),
          source: 'greenhouse',
          source_id: String(j.id),
          is_active: true,
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { console.warn(`greenhouse ${co.slug}:`, e); }
  }
  return jobs;
}

// ── LEVER (Israeli companies) ─────────────
const LV_COMPANIES = [
  { slug: 'riskified',     name: 'Riskified' },
  { slug: 'lightricks',    name: 'Lightricks' },
  { slug: 'forter',        name: 'Forter' },
  { slug: 'next-insurance',name: 'Next Insurance' },
  { slug: 'pagaya',        name: 'Pagaya' },
  { slug: 'guesty',        name: 'Guesty' },
  { slug: 'ironSource',    name: 'ironSource' },
  { slug: 'varonis',       name: 'Varonis' },
  { slug: 'lusha',         name: 'Lusha' },
  { slug: 'salto',         name: 'Salto' },
];

async function fetchLever(): Promise<any[]> {
  const jobs: any[] = [];
  for (const co of LV_COMPANIES) {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${co.slug}?mode=json`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const list = await res.json();
      for (const j of (Array.isArray(list) ? list : [])) {
        const loc = j.categories?.location || j.location || '';
        if (!isIsraeli(loc)) continue;
        if (!devJob((j.text || '') + ' ' + (j.descriptionPlain || ''))) continue;
        jobs.push({
          title: clean(j.text || ''),
          company_name: co.name,
          location: loc,
          url: j.hostedUrl || '',
          description: clean(j.descriptionPlain || ''),
          skills: skills((j.text || '') + ' ' + (j.descriptionPlain || '')),
          remote_type: remote(loc + ' ' + (j.descriptionPlain || '')),
          experience_level: level(j.text || ''),
          job_type: 'fulltime',
          date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
          source: 'lever',
          source_id: j.id,
          is_active: true,
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { console.warn(`lever ${co.slug}:`, e); }
  }
  return jobs;
}

// ── Main ──────────────────────────────────
async function runScan() {
  const { data: log } = await supabase
    .from('scan_logs')
    .insert({ provider: 'all', status: 'running' })
    .select().single();

  const [drushim, linkedin, greenhouse, lever] = await Promise.allSettled([
    fetchDrushim(),
    fetchLinkedIn(),
    fetchGreenhouse(),
    fetchLever(),
  ]);

  const bySource: Record<string, number> = {
    drushim:    drushim.status    === 'fulfilled' ? drushim.value.length    : 0,
    linkedin:   linkedin.status   === 'fulfilled' ? linkedin.value.length   : 0,
    greenhouse: greenhouse.status === 'fulfilled' ? greenhouse.value.length : 0,
    lever:      lever.status      === 'fulfilled' ? lever.value.length      : 0,
  };

  const all = [
    ...(drushim.status    === 'fulfilled' ? drushim.value    : []),
    ...(linkedin.status   === 'fulfilled' ? linkedin.value   : []),
    ...(greenhouse.status === 'fulfilled' ? greenhouse.value : []),
    ...(lever.status      === 'fulfilled' ? lever.value      : []),
  ].filter(j => j.title && j.url);

  let inserted = 0;
  for (let i = 0; i < all.length; i += 50) {
    const { data } = await supabase
      .from('jobs')
      .upsert(all.slice(i, i + 50), { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    inserted += data?.length || 0;
  }

  // Expire jobs older than 45 days
  const cutoff = new Date(Date.now() - 45 * 86400000).toISOString();
  await supabase.from('jobs').update({ is_active: false }).lt('updated_at', cutoff).eq('is_active', true);

  if (log) {
    await supabase.from('scan_logs').update({
      status: 'success',
      jobs_found: all.length,
      jobs_new: inserted,
      completed_at: new Date().toISOString(),
    }).eq('id', log.id);
  }

  return { total: all.length, inserted, bySource };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const data = await runScan();
    return new Response(JSON.stringify({ success: true, ...data }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: CORS });
  }
});
