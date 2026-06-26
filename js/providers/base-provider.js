/* ============================================
   JOBALLERT — Base Job Provider
   All providers extend this class
   ============================================ */

class BaseProvider {
  constructor(config = {}) {
    this.id = config.id || 'unknown';
    this.name = config.name || 'Unknown';
    this.enabled = config.enabled !== false;
    this.rateLimit = config.rateLimit || 1000; // ms between requests
    this._lastFetch = 0;
  }

  // ── Override in subclasses ─────────────────
  async fetchJobs(query) {
    throw new Error(`${this.constructor.name}.fetchJobs() not implemented`);
  }

  // ── Shared helpers ─────────────────────────
  async _throttledFetch(...args) {
    const now = Date.now();
    const wait = this._lastFetch + this.rateLimit - now;
    if (wait > 0) await this._sleep(wait);
    this._lastFetch = Date.now();
    return fetch(...args);
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Normalize a raw job object ─────────────
  _normalizeJob(raw) {
    return {
      external_id:      raw.external_id || raw.id || null,
      title:            this._cleanText(raw.title || ''),
      company_name:     this._cleanText(raw.company || raw.company_name || ''),
      location:         this._cleanText(raw.location || ''),
      remote_type:      this._detectRemote(raw),
      salary_min:       raw.salary_min || raw.salaryMin || null,
      salary_max:       raw.salary_max || raw.salaryMax || null,
      salary_currency:  raw.salary_currency || raw.currency || 'USD',
      salary_period:    raw.salary_period || 'year',
      url:              raw.url || raw.job_url || raw.link || '',
      description:      this._cleanText(raw.description || raw.body || ''),
      requirements:     this._cleanText(raw.requirements || ''),
      skills:           this._extractSkills(raw),
      experience_level: this._detectLevel(raw),
      job_type:         this._detectJobType(raw),
      date_posted:      raw.date_posted || raw.postedDate || raw.posted_at || null,
      source:           this.id,
      source_id:        raw.external_id || raw.id || null,
    };
  }

  _cleanText(str) {
    if (!str) return '';
    return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  _detectRemote(raw) {
    const text = [raw.location, raw.title, raw.description, raw.remote]
      .filter(Boolean).join(' ').toLowerCase();
    if (raw.remote === true || /\bremote\b/.test(text)) return 'remote';
    if (/\bhybrid\b/.test(text)) return 'hybrid';
    if (/\bon[- ]?site\b|\bin[- ]?office\b/.test(text)) return 'onsite';
    return 'unknown';
  }

  _detectLevel(raw) {
    const text = [raw.title, raw.experience_level, raw.seniority, raw.description]
      .filter(Boolean).join(' ').toLowerCase();
    if (/\b(intern|internship|co-op)\b/.test(text)) return 'intern';
    if (/\b(senior|sr\.?|staff|iii|iv)\b/.test(text)) return 'senior';
    if (/\b(lead|principal|architect|director)\b/.test(text)) return 'lead';
    if (/\b(junior|jr\.?|associate|entry[\s-]?level|graduate|new grad|i{1,2})\b/.test(text)) return 'junior';
    if (/\b(mid|ii|middle|2-4 years|3-5 years)\b/.test(text)) return 'mid';
    return 'unknown';
  }

  _detectJobType(raw) {
    const text = [raw.job_type, raw.employment_type, raw.title, raw.description]
      .filter(Boolean).join(' ').toLowerCase();
    if (/\b(contract|contractor|freelance|independent)\b/.test(text)) return 'contract';
    if (/\b(part[\s-]?time)\b/.test(text)) return 'parttime';
    if (/\b(intern|internship)\b/.test(text)) return 'internship';
    return 'fulltime';
  }

  _extractSkills(raw) {
    const skills = [...(raw.skills || raw.required_skills || [])];
    const text = [raw.title, raw.description, raw.requirements, raw.tags]
      .filter(Boolean).join(' ');
    return [...new Set([...skills, ...this._parseSkillsFromText(text)])];
  }

  _parseSkillsFromText(text) {
    if (!text) return [];
    const known = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust',
      'React', 'Vue', 'Angular', 'Next.js', 'Nuxt', 'Svelte',
      'Node.js', 'Express', 'FastAPI', 'Django', 'Spring', 'Rails',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQL',
      'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
      'HTML', 'CSS', 'Sass', 'Tailwind',
      'GraphQL', 'REST', 'gRPC',
      'Git', 'Linux', 'Bash',
      'Machine Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
    ];
    const lower = text.toLowerCase();
    return known.filter(skill => {
      const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return re.test(lower);
    });
  }

  // ── Israel location check ─────────────────
  _isIsraeliOrRemote(job) {
    const loc = (job.location || '').toLowerCase();
    const IL_RE = /\bisrael\b|tel[- ]?aviv|jerusalem|haifa|herzliya|ramat[- ]?gan|be.?er[- ]?sheva|petah[- ]?tikva|ra.?anana|rehovot|netanya|bnei[- ]?brak|holon|modiin|ashdod|ashkelon/i;
    return IL_RE.test(loc) || job.remote_type === 'remote';
  }

  // ── Dedup check ───────────────────────────
  isDuplicate(job, existing) {
    if (!existing?.length) return false;
    return existing.some(e =>
      e.url === job.url ||
      (e.company_name === job.company_name && this._titleSimilarity(e.title, job.title) > 0.85)
    );
  }

  _titleSimilarity(a, b) {
    const sa = new Set(a.toLowerCase().split(/\W+/));
    const sb = new Set(b.toLowerCase().split(/\W+/));
    const inter = [...sa].filter(w => sb.has(w)).length;
    return inter / Math.max(sa.size, sb.size, 1);
  }
}
