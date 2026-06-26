/* ============================================
   JOBALLERT — AI Matching Engine
   Calculates a 0-100 match score for each job
   based on user profile, no external API needed
   ============================================ */

const AIMatcher = {
  // ── Core Match Function ───────────────────
  match(job, profile) {
    if (!job || !profile) return this._emptyResult();

    const components = {
      skills:     this._matchSkills(job, profile),
      title:      this._matchTitle(job, profile),
      experience: this._matchExperience(job, profile),
      location:   this._matchLocation(job, profile),
      salary:     this._matchSalary(job, profile),
      degree:     this._matchDegree(job, profile),
    };

    const W = CONFIG.MATCH_WEIGHTS;
    const score = Math.round(
      components.skills.score     * W.skills     * 100 +
      components.title.score      * W.title      * 100 +
      components.experience.score * W.experience * 100 +
      components.location.score   * W.location   * 100 +
      components.salary.score     * W.salary     * 100 +
      components.degree.score     * W.degree     * 100
    );

    const finalScore = Math.min(100, Math.max(0, score));

    const reasons = this._buildReasons(components, job, profile);
    const missingSkills = components.skills.missing;
    const resumeTips = this._generateResumeTips(job, profile, components);
    const whyFit = this._buildWhyFit(finalScore, job, profile, components);

    return {
      score: finalScore,
      reasons,
      missingSkills,
      resumeTips,
      whyFit,
      components,
    };
  },

  // ── Batch Match ───────────────────────────
  matchAll(jobs, profile) {
    return jobs.map(job => ({
      ...job,
      _match: this.match(job, profile),
    }));
  },

  // ── Skill Matching ────────────────────────
  _matchSkills(job, profile) {
    const userSkills = this._normalizeSkills(profile.skills || []);
    const jobSkills  = this._normalizeSkills(this._extractJobSkills(job));

    if (!jobSkills.length) return { score: 0.7, matched: [], missing: [], total: 0 };

    const matched = jobSkills.filter(s => userSkills.some(u => this._skillsMatch(u, s)));
    const missing = jobSkills.filter(s => !userSkills.some(u => this._skillsMatch(u, s)));

    // Partial credit for related skills
    const partialMatches = missing.filter(s => this._hasRelatedSkill(s, userSkills)).length;
    const rawScore = (matched.length + partialMatches * 0.4) / jobSkills.length;
    const score = Math.min(1, rawScore);

    return {
      score,
      matched: matched.map(s => this._displaySkill(s)),
      missing: missing.filter(s => !this._hasRelatedSkill(s, userSkills)).map(s => this._displaySkill(s)),
      total: jobSkills.length,
      percentage: Math.round(score * 100),
    };
  },

  _extractJobSkills(job) {
    const skills = [...(job.skills || [])];
    const text = ((job.title || '') + ' ' + (job.description || '') + ' ' + (job.requirements || '')).toLowerCase();

    // Extract skills from text
    const SKILL_PATTERNS = [
      'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'go', 'golang', 'rust',
      'react', 'vue', 'angular', 'next\\.?js', 'nuxt', 'svelte', 'node\\.?js', 'express', 'fastapi',
      'django', 'spring', 'laravel', 'rails',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'sql',
      'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'github actions',
      'html', 'css', 'sass', 'tailwind', 'webpack', 'vite',
      'rest', 'graphql', 'grpc', 'websocket',
      'git', 'linux', 'bash', 'shell',
      'machine learning', 'tensorflow', 'pytorch', 'pandas', 'numpy',
      'microservices', 'distributed systems', 'system design',
    ];

    SKILL_PATTERNS.forEach(pattern => {
      const re = new RegExp(`\\b${pattern}\\b`, 'i');
      if (re.test(text)) {
        const clean = pattern.replace(/\\b|\\./g, '').replace(/\\+/g, '+');
        skills.push(clean);
      }
    });

    return [...new Set(skills)].filter(Boolean);
  },

  _normalizeSkills(skills) {
    return skills.map(s => s.toLowerCase().trim().replace(/\s+/g, ' '));
  },

  _skillsMatch(userSkill, jobSkill) {
    if (userSkill === jobSkill) return true;
    // Aliases
    const ALIASES = {
      'javascript': ['js', 'es6', 'es2015', 'ecmascript'],
      'typescript': ['ts'],
      'node.js': ['nodejs', 'node'],
      'next.js': ['nextjs', 'next'],
      'react': ['reactjs', 'react.js'],
      'python': ['py'],
      'c++': ['cpp', 'c plus plus'],
      'postgresql': ['postgres', 'pg'],
      'mongodb': ['mongo'],
      'kubernetes': ['k8s'],
      'golang': ['go'],
      'github actions': ['github-actions', 'ghactions'],
      'sql': ['mysql', 'postgresql', 'sqlite', 'mssql'],
    };
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      const group = [canonical, ...aliases];
      if (group.includes(userSkill) && group.includes(jobSkill)) return true;
    }
    return false;
  },

  _hasRelatedSkill(jobSkill, userSkills) {
    const RELATED = {
      'typescript': ['javascript'],
      'next.js': ['react', 'javascript'],
      'react': ['javascript', 'html', 'css'],
      'node.js': ['javascript'],
      'django': ['python'],
      'spring': ['java'],
      'kubernetes': ['docker'],
      'graphql': ['rest'],
      'postgresql': ['sql', 'mysql'],
      'mongodb': ['sql'],
      'fastapi': ['python'],
      'angular': ['javascript', 'typescript'],
      'vue': ['javascript'],
    };
    const related = RELATED[jobSkill] || [];
    return related.some(r => userSkills.includes(r));
  },

  _displaySkill(skill) {
    const DISPLAY = {
      'javascript': 'JavaScript', 'typescript': 'TypeScript', 'python': 'Python',
      'java': 'Java', 'c++': 'C++', 'c#': 'C#', 'ruby': 'Ruby', 'go': 'Go',
      'golang': 'Go', 'rust': 'Rust', 'react': 'React', 'vue': 'Vue', 'angular': 'Angular',
      'next.js': 'Next.js', 'node.js': 'Node.js', 'postgresql': 'PostgreSQL',
      'mongodb': 'MongoDB', 'aws': 'AWS', 'gcp': 'GCP', 'docker': 'Docker',
      'kubernetes': 'Kubernetes', 'html': 'HTML', 'css': 'CSS', 'sql': 'SQL',
    };
    return DISPLAY[skill] || skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  },

  // ── Title Matching ────────────────────────
  _matchTitle(job, profile) {
    const jobTitle = (job.title || '').toLowerCase();
    const preferred = (profile.preferred_titles || CONFIG.DEFAULT_PROFILE.preferred_titles)
      .map(t => t.toLowerCase());

    let score = 0;

    // Exact/close match
    for (const pt of preferred) {
      if (jobTitle.includes(pt) || pt.includes(jobTitle.split(' ')[0])) {
        score = 1;
        break;
      }
    }

    if (!score) {
      // Keyword overlap
      const keywords = ['software', 'developer', 'engineer', 'frontend', 'backend', 'fullstack', 'full stack', 'full-stack', 'web'];
      const matches = keywords.filter(k => jobTitle.includes(k));
      score = matches.length > 0 ? 0.7 : 0.3;
    }

    return { score };
  },

  // ── Experience Matching ───────────────────
  _matchExperience(job, profile) {
    const jobLevel = job.experience_level || 'unknown';
    const userLevels = (profile.experience_levels || CONFIG.DEFAULT_PROFILE.experience_levels);

    if (jobLevel === 'unknown') return { score: 0.7 };

    if (userLevels.includes(jobLevel)) return { score: 1 };

    // Adjacent levels get partial credit
    const LEVELS = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal'];
    const jobIdx  = LEVELS.indexOf(jobLevel);
    const userIdx = LEVELS.map((l, i) => userLevels.includes(l) ? i : -1).filter(i => i >= 0);

    const minDist = Math.min(...userIdx.map(i => Math.abs(i - jobIdx)));

    if (minDist === 1) return { score: 0.6 };
    if (minDist === 2) return { score: 0.3 };
    return { score: 0.1 };
  },

  // ── Location Matching ─────────────────────
  _matchLocation(job, profile) {
    const remotePreference = profile.remote_preference || 'any';
    const jobRemote = job.remote_type || 'unknown';

    if (remotePreference === 'any') return { score: 0.9 };

    if (remotePreference === 'remote') {
      if (jobRemote === 'remote') return { score: 1 };
      if (jobRemote === 'hybrid') return { score: 0.5 };
      return { score: 0.1 };
    }

    if (remotePreference === 'hybrid') {
      if (jobRemote === 'hybrid') return { score: 1 };
      if (jobRemote === 'remote') return { score: 0.8 };
      return { score: 0.4 };
    }

    if (remotePreference === 'onsite') {
      if (jobRemote === 'onsite') return { score: 1 };
      if (jobRemote === 'hybrid') return { score: 0.7 };
      return { score: 0.5 };
    }

    // Check preferred locations
    const preferredLocs = (profile.preferred_locations || []).map(l => l.toLowerCase());
    if (!preferredLocs.length) return { score: 0.7 };

    const jobLoc = (job.location || '').toLowerCase();
    const matches = preferredLocs.some(l => jobLoc.includes(l) || l.includes(jobLoc.split(',')[0].trim()));
    return { score: matches ? 1 : 0.5 };
  },

  // ── Salary Matching ───────────────────────
  _matchSalary(job, profile) {
    if (!job.salary_min && !job.salary_max) return { score: 0.7 };
    if (!profile.salary_min && !profile.salary_max) return { score: 0.8 };

    const jobMax = job.salary_max || job.salary_min;
    const userMin = profile.salary_min || 0;

    if (jobMax >= userMin) return { score: 1 };
    const ratio = jobMax / userMin;
    return { score: Math.max(0, ratio) };
  },

  // ── Degree Matching ───────────────────────
  _matchDegree(job, profile) {
    const desc = ((job.description || '') + ' ' + (job.requirements || '')).toLowerCase();
    const hasDegreeReq = /\b(degree|bachelor|master|msc|bsc|b\.s\.|m\.s\.|phd|computer science|engineering)\b/.test(desc);

    if (!hasDegreeReq) return { score: 0.9 };

    const userDegree = (profile.degree || '').toLowerCase();
    if (userDegree.includes('msc') || userDegree.includes('master')) return { score: 1 };
    if (userDegree.includes('bsc') || userDegree.includes('bachelor')) {
      const masterReq = /\b(master|msc|m\.s\.|graduate degree)\b/.test(desc);
      return { score: masterReq ? 0.7 : 1 };
    }

    return { score: 0.6 };
  },

  // ── Reasons Generator ─────────────────────
  _buildReasons(components, job, profile) {
    const reasons = [];

    // Skills
    if (components.skills.matched.length > 0) {
      const top = components.skills.matched.slice(0, 3).join(', ');
      reasons.push({ type: 'good', text: `Matches ${components.skills.matched.length} of your skills: ${top}${components.skills.matched.length > 3 ? ' +more' : ''}` });
    }

    if (components.skills.missing.length > 0) {
      const top = components.skills.missing.slice(0, 2).join(', ');
      reasons.push({ type: 'bad', text: `Missing skills: ${top}${components.skills.missing.length > 2 ? ` (+${components.skills.missing.length - 2} more)` : ''}` });
    }

    // Experience
    const jobLevel = job.experience_level;
    if (jobLevel && jobLevel !== 'unknown') {
      const userLevels = profile.experience_levels || CONFIG.DEFAULT_PROFILE.experience_levels;
      if (userLevels.includes(jobLevel)) {
        reasons.push({ type: 'good', text: `${CONFIG.EXPERIENCE_LABELS[jobLevel]} role aligns with your level` });
      } else {
        reasons.push({ type: 'neutral', text: `Listed as ${CONFIG.EXPERIENCE_LABELS[jobLevel]} — slightly outside your target level` });
      }
    }

    // Remote
    if (job.remote_type === 'remote') {
      reasons.push({ type: 'good', text: 'Fully remote position' });
    } else if (job.remote_type === 'hybrid') {
      reasons.push({ type: 'neutral', text: 'Hybrid work model' });
    }

    // Salary
    if (job.salary_min || job.salary_max) {
      const formatted = Utils.formatSalary(job.salary_min, job.salary_max, job.salary_currency);
      reasons.push({ type: 'good', text: `Salary range: ${formatted}` });
    }

    // Degree
    if (components.degree.score >= 0.9) {
      reasons.push({ type: 'good', text: `Your ${profile.degree || 'CS degree'} meets requirements` });
    }

    return reasons;
  },

  // ── Resume Tips ───────────────────────────
  _generateResumeTips(job, profile, components) {
    const tips = [];
    const missing = components.skills.missing;

    if (missing.length > 0) {
      tips.push(`Add a project using ${missing[0]} to close the skill gap`);
    }

    if (components.skills.percentage < 60) {
      tips.push('Highlight any coursework or personal projects related to this role\'s tech stack');
    }

    if (job.remote_type === 'remote') {
      tips.push('Emphasise remote collaboration experience and async communication skills');
    }

    const desc = (job.description || '').toLowerCase();
    if (desc.includes('agile') || desc.includes('scrum')) {
      tips.push('Mention Agile/Scrum experience or coursework on your CV');
    }

    if (desc.includes('open source')) {
      tips.push('Link to your GitHub and highlight any open source contributions');
    }

    if (desc.includes('startup')) {
      tips.push('Emphasise your ability to work in fast-paced, ambiguous environments');
    }

    if (tips.length === 0) {
      tips.push('Your profile is a strong match — tailor your cover letter with specific examples');
    }

    return tips.slice(0, 3);
  },

  // ── Why Fit Summary ───────────────────────
  _buildWhyFit(score, job, profile, components) {
    const skillPct = components.skills.percentage;
    const company = job.company_name;
    const title = job.title;

    if (score >= 85) {
      return `Excellent match! You have ${skillPct}% of the required skills for this ${title} role at ${company}. Your ${profile.degree || 'CS background'} and experience level align perfectly.`;
    }

    if (score >= 70) {
      const matched = components.skills.matched.slice(0, 3).join(', ');
      return `Strong match for ${title} at ${company}. Your skills in ${matched} are directly relevant. A few skill gaps exist but your overall profile is competitive.`;
    }

    if (score >= 50) {
      return `Moderate match for ${title} at ${company}. You cover core requirements but have some gaps. Consider applying and addressing missing skills in your cover letter.`;
    }

    return `Stretch opportunity at ${company}. This ${title} role requires skills beyond your current profile, but could be worth applying to if you\'re targeting growth.`;
  },

  _emptyResult() {
    return { score: 0, reasons: [], missingSkills: [], resumeTips: [], whyFit: '', components: {} };
  },

  // ── Batch Compute & Cache ─────────────────
  computeAndCache(jobs, profile) {
    const results = {};
    jobs.forEach(job => {
      results[job.id] = this.match(job, profile);
    });
    Utils.store.set('match_cache', { ts: Date.now(), results });
    return results;
  },

  getCached() {
    const cache = Utils.store.get('match_cache');
    if (!cache) return null;
    if (Date.now() - cache.ts > 30 * 60 * 1000) return null; // 30 min TTL
    return cache.results;
  },

  clearCache() { Utils.store.remove('match_cache'); },
};
