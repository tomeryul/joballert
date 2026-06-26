/* ============================================
   JOBALLERT — Job Management & Rendering
   ============================================ */

const JobManager = {
  _jobs: [],
  _userJobsMap: {},
  _matchCache: {},
  _currentPage: 1,
  _totalCount: 0,
  _filters: {},

  async init() {
    if (Auth.isLoggedIn) {
      this._userJobsMap = await DB.getUserJobsMap(Auth.user.id);
      this._matchCache = AIMatcher.getCached() || {};
    }
  },

  // ── Fetch Jobs ────────────────────────────
  async fetchJobs(filters = {}, page = 1) {
    this._filters = filters;
    this._currentPage = page;

    const { data, error, count } = await DB.getJobs({
      ...filters,
      page,
      limit: CONFIG.JOBS_PER_PAGE,
    });

    if (error) throw error;

    this._jobs = data || [];
    this._totalCount = count || 0;

    // Run AI matching
    if (Auth.isLoggedIn) {
      const profile = Auth.getEffectiveProfile();
      this._jobs.forEach(job => {
        if (!this._matchCache[job.id]) {
          this._matchCache[job.id] = AIMatcher.match(job, profile);
        }
      });
    }

    return { jobs: this._jobs, total: this._totalCount };
  },

  getMatch(jobId) {
    return this._matchCache[jobId] || null;
  },

  getUserJobStatus(jobId) {
    return this._userJobsMap[jobId] || null;
  },

  // ── Job Actions ───────────────────────────
  async saveJob(jobId) {
    if (!Auth.isLoggedIn) { Toasts.warning('Login required', 'Please sign in to save jobs'); return; }
    const current = this._userJobsMap[jobId];
    if (current?.status === 'saved') {
      await this._setStatus(jobId, 'viewed');
      return 'unsaved';
    }
    await this._setStatus(jobId, 'saved');
    return 'saved';
  },

  async markApplied(jobId, notes = '') {
    if (!Auth.isLoggedIn) return;
    const match = this._matchCache[jobId];
    await this._setStatus(jobId, 'applied', {
      applied_at: new Date().toISOString(),
      notes,
      match_score: match?.score,
      match_reasons: match?.reasons || [],
      missing_skills: match?.missingSkills || [],
      why_fit: match?.whyFit,
    });
  },

  async updateStatus(jobId, status, extra = {}) {
    await this._setStatus(jobId, status, extra);
  },

  async _setStatus(jobId, status, extra = {}) {
    if (!Auth.isLoggedIn) return;
    const match = this._matchCache[jobId];
    const { data } = await DB.upsertUserJob(Auth.user.id, jobId, {
      status,
      match_score: match?.score,
      match_reasons: match?.reasons || [],
      missing_skills: match?.missingSkills || [],
      resume_tips: match?.resumeTips || [],
      why_fit: match?.whyFit,
      ...extra,
    });
    if (data) {
      this._userJobsMap[jobId] = data;
      Utils.emit('job:status_changed', { jobId, status, data });
    }
  },

  // ── Rendering ─────────────────────────────
  renderJobCard(job, opts = {}) {
    const match = this.getMatch(job.id);
    const userJob = this.getUserJobStatus(job.id);
    const status = userJob?.status || null;
    const score = match?.score ?? null;

    const salary = Utils.formatSalary(job.salary_min, job.salary_max, job.salary_currency);
    const postedAgo = Utils.timeAgo(job.date_posted || job.created_at);
    const remote = Utils.getRemoteBadge(job.remote_type);
    const expBadge = Utils.getExperienceBadge(job.experience_level);
    const skills = (job.skills || []).slice(0, 4);
    const moreSk = (job.skills || []).length - 4;

    const logo = `
      <div class="company-logo">
        <img src="https://logo.clearbit.com/${this._getDomain(job.company_name)}"
          alt="${Utils.escapeHtml(job.company_name)}"
          onerror="this.style.display='none';this.parentNode.textContent='${Utils.escapeHtml(Utils.getCompanyInitials(job.company_name))}'">
      </div>`;

    const scoreHtml = score !== null ? `
      <div class="job-card-score" title="AI Match Score">
        ${Utils.getScoreRing(score, 44)}
      </div>` : '';

    const skillTags = skills.map(s =>
      `<span class="skill-tag">${Utils.escapeHtml(s)}</span>`
    ).join('') + (moreSk > 0 ? `<span class="skill-tag">+${moreSk}</span>` : '');

    const statusBadge = status && status !== 'viewed'
      ? `<span class="job-status-badge status-${status}">${CONFIG.STATUS_CONFIG[status]?.label || status}</span>`
      : '';

    const isSaved = status === 'saved';
    const isApplied = ['applied','interviewing','offered'].includes(status);
    const featuredClass = score >= 80 ? 'featured' : '';

    return `
      <article class="job-card ${featuredClass}" data-job-id="${job.id}" data-url="${Utils.escapeHtml(job.url)}">
        <div class="job-card-header">
          ${logo}
          <div class="job-card-info">
            <div class="job-title">${Utils.escapeHtml(job.title)}</div>
            <div class="job-company">${Utils.escapeHtml(job.company_name)}</div>
          </div>
          ${scoreHtml}
        </div>

        <div class="job-meta">
          ${job.location ? `<span class="job-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${Utils.escapeHtml(job.location)}
          </span>` : ''}
          ${remote}
          ${expBadge}
          ${salary ? `<span class="job-salary">${salary}</span>` : ''}
          ${statusBadge}
        </div>

        ${skills.length ? `<div class="job-skills">${skillTags}</div>` : ''}

        <div class="job-card-footer">
          <div class="flex items-center gap-2">
            <span class="job-posted">${postedAgo}</span>
            <span class="job-source">${Utils.escapeHtml(job.source)}</span>
          </div>
          <div class="job-actions">
            <button class="job-action-btn ${isSaved ? 'active-save' : ''}" data-action="save" data-job-id="${job.id}" title="${isSaved ? 'Unsave' : 'Save job'}">
              <svg viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            </button>
            <button class="job-action-btn ${isApplied ? 'active-apply' : ''}" data-action="apply" data-job-id="${job.id}" title="${isApplied ? 'Applied ✓' : 'Mark applied'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <a href="${Utils.escapeHtml(job.url)}" target="_blank" rel="noopener" class="job-action-btn" title="Open job">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      </article>`;
  },

  renderJobDetail(job, match) {
    const salary = Utils.formatSalary(job.salary_min, job.salary_max, job.salary_currency);
    const score = match?.score ?? null;

    const matchPanel = match ? `
      <div class="ai-match-panel">
        <div class="ai-match-header">
          <span class="ai-match-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            AI Match Analysis
          </span>
          <span class="ai-match-score-large ${Utils.scoreClass(score) === 'high' ? 'text-success' : Utils.scoreClass(score) === 'med' ? 'text-warning' : 'text-danger'}">${score}%</span>
        </div>
        <div class="ai-match-progress">
          <div class="ai-match-bar" style="width:${score}%"></div>
        </div>
        <p class="text-sm text-secondary" style="margin-bottom:0.75rem">${Utils.escapeHtml(match.whyFit || '')}</p>
        <div class="ai-match-reasons">
          ${(match.reasons || []).map(r => `
            <div class="ai-reason">
              <span class="ai-reason-icon ${r.type}">
                ${r.type === 'good' ? '✓' : r.type === 'bad' ? '✗' : '→'}
              </span>
              <span>${Utils.escapeHtml(r.text)}</span>
            </div>`).join('')}
        </div>
        ${match.missingSkills?.length ? `
          <div style="margin-top:0.875rem">
            <div class="text-xs text-muted" style="margin-bottom:0.375rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Missing Skills</div>
            <div class="flex flex-wrap gap-1">
              ${match.missingSkills.map(s => `<span class="skill-tag missing">${Utils.escapeHtml(s)}</span>`).join('')}
            </div>
          </div>` : ''}
        ${match.resumeTips?.length ? `
          <div style="margin-top:0.875rem">
            <div class="text-xs text-muted" style="margin-bottom:0.375rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Resume Tips</div>
            ${match.resumeTips.map(t => `<div class="ai-reason"><span class="ai-reason-icon neutral">💡</span><span class="text-sm">${Utils.escapeHtml(t)}</span></div>`).join('')}
          </div>` : ''}
      </div>` : '';

    return `
      <div class="job-detail-header">
        <div class="job-detail-logo">
          <img src="https://logo.clearbit.com/${this._getDomain(job.company_name)}"
            alt="${Utils.escapeHtml(job.company_name)}"
            onerror="this.style.display='none';this.parentNode.textContent='${Utils.escapeHtml(Utils.getCompanyInitials(job.company_name))}'">
        </div>
        <div>
          <div class="job-detail-title">${Utils.escapeHtml(job.title)}</div>
          <div class="job-detail-company">${Utils.escapeHtml(job.company_name)}</div>
        </div>
      </div>

      <div class="job-detail-meta">
        ${job.location ? `<div class="detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${Utils.escapeHtml(job.location)}</div>` : ''}
        <div class="detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>${CONFIG.REMOTE_LABELS[job.remote_type] || 'Unknown'}</div>
        ${job.experience_level && job.experience_level !== 'unknown' ? `<div class="detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${CONFIG.EXPERIENCE_LABELS[job.experience_level]}</div>` : ''}
        ${salary ? `<div class="detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>${salary}</div>` : ''}
        <div class="detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${Utils.formatDate(job.date_posted)}</div>
        <div class="detail-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>via ${Utils.capitalize(job.source)}</div>
      </div>

      ${matchPanel}

      ${(job.skills || []).length ? `
        <div style="margin-bottom:1.25rem">
          <h4 style="margin-bottom:0.5rem">Skills Required</h4>
          <div class="flex flex-wrap gap-2">
            ${(job.skills || []).map(s => `<span class="skill-tag">${Utils.escapeHtml(s)}</span>`).join('')}
          </div>
        </div>` : ''}

      <div class="job-description">
        <h4>Job Description</h4>
        <div style="margin-top:0.75rem">${this._formatDescription(job.description || job.requirements || 'No description available.')}</div>
      </div>`;
  },

  // ── Event Delegation ──────────────────────
  initCardActions(container) {
    container.addEventListener('click', async (e) => {
      const actionBtn = e.target.closest('[data-action]');
      const card = e.target.closest('.job-card');

      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const jobId = actionBtn.dataset.jobId;

        if (action === 'save') {
          const result = await this.saveJob(jobId);
          if (result === 'saved') {
            actionBtn.classList.add('active-save');
            actionBtn.querySelector('svg').setAttribute('fill', 'currentColor');
            Toasts.success('Job saved', 'Added to your saved jobs');
          } else {
            actionBtn.classList.remove('active-save');
            actionBtn.querySelector('svg').setAttribute('fill', 'none');
            Toasts.info('Removed', 'Job removed from saved');
          }
        }

        if (action === 'apply') {
          await this.markApplied(jobId);
          actionBtn.classList.add('active-apply');
          Toasts.success('Marked as applied!', 'Tracked in your applications');
        }
        return;
      }

      if (card) {
        const jobId = card.dataset.jobId;
        const job = this._jobs.find(j => j.id === jobId);
        if (job) this.showJobModal(job);
      }
    });
  },

  showJobModal(job) {
    const match = this.getMatch(job.id);
    const userJob = this.getUserJobStatus(job.id);
    const status = userJob?.status || null;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>Job Details</h3>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          ${this.renderJobDetail(job, match)}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-save-btn">
            <svg viewBox="0 0 24 24" fill="${status === 'saved' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            ${status === 'saved' ? 'Saved' : 'Save Job'}
          </button>
          <a href="${Utils.escapeHtml(job.url)}" target="_blank" rel="noopener" class="btn btn-primary">
            Apply Now
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>`;

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#modal-save-btn').addEventListener('click', async (e) => {
      const result = await this.saveJob(job.id);
      e.currentTarget.innerHTML = result === 'saved'
        ? `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> Saved`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> Save Job`;
    });

    document.body.appendChild(modal);

    // Mark as viewed
    if (Auth.isLoggedIn && !userJob) {
      this._setStatus(job.id, 'viewed');
    }
  },

  renderPagination(total, page, perPage) {
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return '';

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return `
      <div class="pagination">
        <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        ${pages.map(p => p === '...'
          ? `<span class="page-btn" style="cursor:default;color:var(--text-muted)">…</span>`
          : `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
        <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  },

  renderSkeletons(count = 6) {
    return Array.from({ length: count }, () => `
      <div class="job-card" style="pointer-events:none">
        <div class="job-card-header">
          <div class="skeleton" style="width:44px;height:44px;border-radius:10px;flex-shrink:0"></div>
          <div style="flex:1">
            <div class="skeleton" style="height:16px;width:60%;margin-bottom:8px"></div>
            <div class="skeleton" style="height:12px;width:40%"></div>
          </div>
        </div>
        <div class="flex gap-2" style="margin-bottom:0.875rem">
          <div class="skeleton" style="height:20px;width:80px;border-radius:6px"></div>
          <div class="skeleton" style="height:20px;width:60px;border-radius:6px"></div>
        </div>
        <div class="flex gap-2">
          ${Array(3).fill('<div class="skeleton" style="height:24px;width:70px;border-radius:6px"></div>').join('')}
        </div>
      </div>`).join('');
  },

  // ── Helpers ───────────────────────────────
  _getDomain(companyName) {
    const DOMAIN_MAP = {
      'google': 'google.com', 'meta': 'meta.com', 'stripe': 'stripe.com',
      'vercel': 'vercel.com', 'linear': 'linear.app', 'supabase': 'supabase.com',
      'shopify': 'shopify.com', 'atlassian': 'atlassian.com', 'figma': 'figma.com',
      'github': 'github.com', 'cloudflare': 'cloudflare.com', 'notion': 'notion.so',
    };
    const key = (companyName || '').toLowerCase().replace(/\s+/g, '');
    return DOMAIN_MAP[key] || `${key}.com`;
  },

  _formatDescription(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/•\s/g, '<br>• ')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  },
};
