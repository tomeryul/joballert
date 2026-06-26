/* ============================================
   JOBALLERT — Utility Functions
   ============================================ */

const Utils = {
  // ── Time ──────────────────────────────────
  timeAgo(dateStr) {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days/7)}w ago`;
    if (days < 365) return `${Math.floor(days/30)}mo ago`;
    return `${Math.floor(days/365)}y ago`;
  },

  formatDate(dateStr, opts = {}) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', ...opts,
    });
  },

  // ── Numbers ───────────────────────────────
  formatSalary(min, max, currency = 'USD', period = 'year') {
    if (!min && !max) return null;
    const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(0)}k` : `${n}`;
    const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
    if (min && max) return `${sym}${fmt(min)}–${fmt(max)}`;
    if (min) return `${sym}${fmt(min)}+`;
    return `Up to ${sym}${fmt(max)}`;
  },

  formatNumber(n) {
    if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n/1000).toFixed(1)}k`;
    return String(n);
  },

  // ── Strings ───────────────────────────────
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  slugify(str) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  },

  initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  truncate(str, len = 100) {
    if (!str || str.length <= len) return str;
    return str.slice(0, len).trim() + '…';
  },

  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ── Arrays ────────────────────────────────
  unique(arr) { return [...new Set(arr)]; },

  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  },

  sortBy(arr, key, dir = 'asc') {
    return [...arr].sort((a, b) => {
      const av = typeof key === 'function' ? key(a) : a[key];
      const bv = typeof key === 'function' ? key(b) : b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  },

  // ── DOM ───────────────────────────────────
  el(selector, parent = document) { return parent.querySelector(selector); },
  els(selector, parent = document) { return [...parent.querySelectorAll(selector)]; },

  show(el) { if (el) el.classList.remove('hidden'); },
  hide(el) { if (el) el.classList.add('hidden'); },
  toggle(el, show) { if (el) el.classList.toggle('hidden', !show); },

  setLoading(el, loading, text = 'Loading...') {
    if (!el) return;
    if (loading) {
      el.dataset.originalText = el.innerHTML;
      el.disabled = true;
      el.innerHTML = `<span class="loading-spinner"></span> ${text}`;
    } else {
      el.disabled = false;
      el.innerHTML = el.dataset.originalText || '';
    }
  },

  scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); },

  // ── Local Storage ─────────────────────────
  store: {
    get(key) {
      try { return JSON.parse(localStorage.getItem(`joballert:${key}`)); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(`joballert:${key}`, JSON.stringify(value)); } catch {}
    },
    remove(key) { localStorage.removeItem(`joballert:${key}`); },
    clear() {
      Object.keys(localStorage).filter(k => k.startsWith('joballert:')).forEach(k => localStorage.removeItem(k));
    },
  },

  // ── URL ───────────────────────────────────
  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  setParam(name, value) {
    const url = new URL(window.location);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    window.history.replaceState({}, '', url);
  },

  buildUrl(base, params) {
    const url = new URL(base, window.location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    return url.toString();
  },

  // ── Score helpers ─────────────────────────
  scoreClass(score) {
    if (score >= 75) return 'high';
    if (score >= 50) return 'med';
    return 'low';
  },

  scoreColor(score) {
    if (score >= 75) return 'var(--accent-success)';
    if (score >= 50) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  },

  // ── Debounce / Throttle ───────────────────
  debounce(fn, delay = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  },

  throttle(fn, limit = 200) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= limit) { last = now; fn(...args); }
    };
  },

  // ── Clipboard ─────────────────────────────
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
      return true;
    }
  },

  // ── Job helpers ───────────────────────────
  getCompanyInitials(name) {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  },

  getRemoteBadge(type) {
    const map = {
      remote: '<span class="badge badge-success">Remote</span>',
      hybrid: '<span class="badge badge-warning">Hybrid</span>',
      onsite: '<span class="badge badge-muted">On-site</span>',
      unknown: '',
    };
    return map[type] || '';
  },

  getExperienceBadge(level) {
    const map = {
      intern: '<span class="badge badge-muted">Intern</span>',
      junior: '<span class="badge badge-cyan">Junior</span>',
      mid: '<span class="badge badge-info">Mid-Level</span>',
      senior: '<span class="badge badge-primary">Senior</span>',
      lead: '<span class="badge badge-warning">Lead</span>',
      principal: '<span class="badge badge-danger">Principal</span>',
    };
    return map[level] || '';
  },

  getScoreRing(score, size = 44) {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const colorClass = score >= 75 ? 'score-high' : score >= 50 ? 'score-med' : 'score-low';
    const color = score >= 75 ? 'var(--accent-success)' : score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';
    return `
      <div class="score-ring" style="width:${size}px;height:${size}px" title="Match score: ${score}%">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle class="score-ring-track" cx="${size/2}" cy="${size/2}" r="${r}"/>
          <circle class="score-ring-fill ${colorClass}"
            cx="${size/2}" cy="${size/2}" r="${r}"
            style="stroke-dasharray:${circ};stroke-dashoffset:${offset};stroke:${color}"/>
        </svg>
        <span class="score-number ${colorClass}">${score}</span>
      </div>`;
  },

  // ── Event Bus ─────────────────────────────
  _listeners: {},

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  },

  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach(h => h(data));
  },
};
