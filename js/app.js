/* ============================================
   JOBALLERT — Main Application Controller
   ============================================ */

const App = {
  _scanTimer: null,
  _realtimeChannel: null,

  async init() {
    // Init Supabase client through Auth
    await Auth.init();

    // Init toasts
    Toasts.init();

    // Setup sidebar toggle (mobile)
    this._initSidebar();

    // Highlight active nav
    this._highlightNav();

    // Setup topbar search
    this._initSearch();

    // If user is logged in, setup live features
    if (Auth.isLoggedIn) {
      await this._initUserFeatures();
    }

    // Update auth-dependent UI
    this._updateAuthUI();
  },

  async _initUserFeatures() {
    const userId = Auth.user.id;

    // Init notification badge & realtime
    await NotificationManager.init(userId);

    // Init push notifications
    await PushNotifications.init();

    // Subscribe to new jobs (realtime)
    this._realtimeChannel = DB.subscribeToJobs(async (payload) => {
      const job = payload.new;
      const profile = Auth.getEffectiveProfile();
      const match = AIMatcher.match(job, profile);

      if (match.score >= (Auth.settings?.min_match_score || CONFIG.MIN_RECOMMENDED_SCORE)) {
        Toasts.info(`New job: ${job.title}`, `${job.company_name} — ${match.score}% match`, 6000);
        await NotificationManager.notifyNewJob(userId, job, match.score);
      }
    });

    // Schedule periodic scan
    this._startScanCycle();
  },

  _startScanCycle() {
    const interval = (Auth.settings?.scan_frequency_hours || 1) * 60 * 60 * 1000;
    const lastScan = Utils.store.get('last_scan_ts');
    const now = Date.now();

    // If more than 1 hour since last scan, run now
    if (!lastScan || now - lastScan > interval) {
      setTimeout(() => this._runScan(), 3000);
    }

    this._scanTimer = setInterval(() => this._runScan(), interval);
  },

  async _runScan() {
    if (!Auth.isLoggedIn) return;
    try {
      const session = await DB.getSession();
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/job-scanner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token || CONFIG.SUPABASE_ANON_KEY}`,
        },
      });
      const result = await res.json();
      Utils.store.set('last_scan_ts', Date.now());
      Utils.store.set('last_scan_result', result);
      Utils.emit('scan:complete', result);
      return result;
    } catch (err) {
      console.error('Scan error:', err);
    }
  },

  _initSidebar() {
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const toggle = () => {
      sidebar?.classList.toggle('open');
      overlay?.classList.toggle('open');
    };

    hamburger?.addEventListener('click', toggle);
    overlay?.addEventListener('click', toggle);

    // Close on nav item click (mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 768) toggle();
      });
    });
  },

  _highlightNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href && (href === page || (page === '' && href === 'index.html'))) {
        item.classList.add('active');
      }
    });
  },

  _initSearch() {
    const input = document.getElementById('global-search');
    if (!input) return;

    const handler = Utils.debounce((e) => {
      const q = e.target.value.trim();
      if (q.length > 2) {
        window.location.href = `jobs.html?search=${encodeURIComponent(q)}`;
      }
    }, 400);

    input.addEventListener('input', handler);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) window.location.href = `jobs.html?search=${encodeURIComponent(q)}`;
      }
    });
  },

  _updateAuthUI() {
    // Update user info in sidebar
    const nameEl  = document.getElementById('sidebar-user-name');
    const emailEl = document.getElementById('sidebar-user-email');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (Auth.isLoggedIn) {
      const profile = Auth.profile || {};
      const user = Auth.user;
      const name = profile.full_name || user.email?.split('@')[0] || 'User';
      const email = user.email || '';

      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = email;
      if (avatarEl) avatarEl.textContent = Utils.initials(name);
    }
  },

  destroy() {
    clearInterval(this._scanTimer);
    NotificationManager.destroy();
    if (this._realtimeChannel) DB.unsubscribe(this._realtimeChannel);
  },
};

// ── Sidebar HTML Generator ─────────────────
function buildSidebar(activePage) {
  const pages = [
    { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: navIcons.dashboard },
    { id: 'jobs', href: 'jobs.html', label: 'All Jobs', icon: navIcons.jobs },
    { id: 'recommended', href: 'recommended.html', label: 'Recommended', icon: navIcons.recommended, badge: 'AI' },
    { id: 'saved', href: 'saved.html', label: 'Saved Jobs', icon: navIcons.saved },
    { id: 'applied', href: 'applied.html', label: 'Applied', icon: navIcons.applied },
    { id: 'companies', href: 'companies.html', label: 'Companies', icon: navIcons.companies },
    { id: 'notifications', href: 'notifications.html', label: 'Notifications', icon: navIcons.notifications },
    { id: 'settings', href: 'settings.html', label: 'Settings', icon: navIcons.settings },
  ];

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">⚡</div>
        <span class="sidebar-logo-text">JobAlert</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-label">Navigation</div>
          ${pages.slice(0, 6).map(p => `
            <a href="${p.href}" class="nav-item ${activePage === p.id ? 'active' : ''}">
              <svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p.icon}</svg>
              ${p.label}
              ${p.badge ? `<span class="nav-badge">${p.badge}</span>` : ''}
            </a>`).join('')}
        </div>
        <div class="nav-section">
          <div class="nav-section-label">Account</div>
          ${pages.slice(6).map(p => `
            <a href="${p.href}" class="nav-item ${activePage === p.id ? 'active' : ''}">
              <svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p.icon}</svg>
              ${p.label}
              ${p.id === 'notifications' ? '<span class="nav-badge" id="notif-badge" style="display:none">0</span>' : ''}
            </a>`).join('')}
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user" onclick="Auth.signOut()">
          <div class="user-avatar" id="sidebar-user-avatar">U</div>
          <div class="user-info">
            <div class="user-name" id="sidebar-user-name">Loading...</div>
            <div class="user-email" id="sidebar-user-email"></div>
          </div>
          <svg style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>`;
}

const navIcons = {
  dashboard:     '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  jobs:          '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
  recommended:   '<path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>',
  saved:         '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
  applied:       '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  companies:     '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  notifications: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  settings:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
};

function buildTopbar() {
  return `
    <header class="topbar">
      <button class="hamburger-btn" id="hamburger-btn" aria-label="Menu">
        <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="topbar-search">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="global-search" placeholder="Search jobs, companies, skills…" autocomplete="off">
      </div>
      <div class="topbar-actions">
        <a href="notifications.html" class="topbar-btn" title="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <span class="notification-dot" id="topbar-notif-dot" style="display:none"></span>
        </a>
        <a href="settings.html" class="topbar-btn" title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </a>
      </div>
    </header>`;
}
