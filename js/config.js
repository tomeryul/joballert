/* ============================================
   JOBALLERT — Configuration
   ============================================ */
const CONFIG = {
  SUPABASE_URL: 'https://whrzgnleryhptaqorqtb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocnpnbmxlcnlocHRhcW9ycXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDc5ODgsImV4cCI6MjA5Nzk4Mzk4OH0.S8Qogk1ZRqkZ6f_DRL8n7Rr05UawdpUUEo7IXFz5nkA',

  APP_NAME: 'JobAlert',
  APP_VERSION: '1.0.0',

  // Pages
  PAGES: {
    INDEX: 'index.html',
    DASHBOARD: 'dashboard.html',
    JOBS: 'jobs.html',
    RECOMMENDED: 'recommended.html',
    SAVED: 'saved.html',
    APPLIED: 'applied.html',
    COMPANIES: 'companies.html',
    NOTIFICATIONS: 'notifications.html',
    SETTINGS: 'settings.html',
  },

  // Default user profile (your profile)
  DEFAULT_PROFILE: {
    degree: 'MSc Computer Science',
    experience_years: 2,
    skills: ['JavaScript', 'React', 'Java', 'Python', 'C', 'C++', 'SQL', 'HTML', 'CSS', 'Node.js', 'Git', 'TypeScript'],
    preferred_titles: ['Software Developer', 'Full Stack Developer', 'Backend Developer', 'Frontend Developer', 'Junior Software Engineer'],
    experience_levels: ['junior', 'mid'],
    remote_preference: 'any',
    location: 'Israel',
  },

  // AI Matching weights (out of 100)
  MATCH_WEIGHTS: {
    skills:          0.40,
    title:           0.20,
    experience:      0.15,
    location:        0.10,
    salary:          0.10,
    degree:          0.05,
  },

  // Pagination
  JOBS_PER_PAGE: 20,

  // Scan interval (ms) - how often client re-fetches new jobs
  SCAN_INTERVAL_MS: 60 * 60 * 1000,

  // Minimum match score to show in Recommended
  MIN_RECOMMENDED_SCORE: 60,

  // Job providers
  PROVIDERS: [
    { id: 'linkedin',    name: 'LinkedIn',     icon: '💼', color: '#0077B5' },
    { id: 'indeed',      name: 'Indeed',       icon: '🔵', color: '#2164F3' },
    { id: 'glassdoor',   name: 'Glassdoor',    icon: '🟢', color: '#0CAA41' },
    { id: 'greenhouse',  name: 'Greenhouse',   icon: '🌿', color: '#24A147' },
    { id: 'lever',       name: 'Lever',        icon: '⚙️', color: '#1EBBD7' },
    { id: 'workday',     name: 'Workday',      icon: '🔶', color: '#F36F21' },
    { id: 'comeet',      name: 'Comeet',       icon: '🟣', color: '#6B48C8' },
    { id: 'ashby',       name: 'Ashby',        icon: '⚡', color: '#5865F2' },
    { id: 'wellfound',   name: 'Wellfound',    icon: '🚀', color: '#FF6B6B' },
    { id: 'ziprecruiter',name: 'ZipRecruiter', icon: '📮', color: '#FF6900' },
    { id: 'monster',     name: 'Monster',      icon: '👾', color: '#6E0F89' },
    { id: 'google',      name: 'Google Jobs',  icon: '🔍', color: '#4285F4' },
    { id: 'startup',     name: 'Startup.jobs', icon: '🌱', color: '#00B47B' },
    { id: 'vercel',      name: 'Vercel',       icon: '▲', color: '#FFFFFF' },
    { id: 'supabase',    name: 'Supabase',     icon: '⚡', color: '#3ECF8E' },
    { id: 'stripe',      name: 'Stripe',       icon: '💳', color: '#635BFF' },
    { id: 'github',      name: 'GitHub',       icon: '🐙', color: '#E6EDF3' },
    { id: 'meta',        name: 'Meta',         icon: '🔷', color: '#1877F2' },
    { id: 'figma',       name: 'Figma',        icon: '🎨', color: '#F24E1E' },
    { id: 'linear',      name: 'Linear',       icon: '◻', color: '#5E6AD2' },
    { id: 'atlassian',   name: 'Atlassian',    icon: '🔷', color: '#0052CC' },
    { id: 'shopify',     name: 'Shopify',      icon: '🛍', color: '#96BF48' },
    { id: 'notion',      name: 'Notion',       icon: '📝', color: '#FFFFFF' },
    { id: 'cloudflare',  name: 'Cloudflare',   icon: '☁️', color: '#F48120' },
  ],

  // Experience level display labels
  EXPERIENCE_LABELS: {
    intern: 'Intern',
    junior: 'Junior',
    mid: 'Mid-Level',
    senior: 'Senior',
    lead: 'Lead',
    principal: 'Principal',
    unknown: 'Any Level',
  },

  // Remote type display labels
  REMOTE_LABELS: {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'On-site',
    unknown: 'Any',
  },

  // Status labels & colors
  STATUS_CONFIG: {
    viewed:       { label: 'Viewed',       color: 'muted' },
    saved:        { label: 'Saved',        color: 'warning' },
    applied:      { label: 'Applied',      color: 'success' },
    interviewing: { label: 'Interviewing', color: 'info' },
    offered:      { label: 'Offered',      color: 'primary' },
    rejected:     { label: 'Rejected',     color: 'danger' },
    withdrawn:    { label: 'Withdrawn',    color: 'muted' },
  },
};

// Freeze to prevent accidental mutations
Object.freeze(CONFIG);
Object.freeze(CONFIG.MATCH_WEIGHTS);
