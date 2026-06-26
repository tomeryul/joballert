/* ============================================
   JOBALLERT — Notifications (Toast + Push)
   ============================================ */

const Toasts = {
  _container: null,

  init() {
    this._container = document.getElementById('toast-container');
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'toast-container';
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
  },

  show(title, message = '', type = 'info', duration = 4000) {
    const icons = {
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
      error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    const colorMap = { success: 'var(--accent-success)', error: 'var(--accent-danger)', warning: 'var(--accent-warning)', info: 'var(--accent-info)' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon" style="color:${colorMap[type]}">${icons[type] || icons.info}</span>
      <div class="toast-content">
        <div class="toast-title">${Utils.escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${Utils.escapeHtml(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close">×</button>`;

    const close = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', close);
    this._container.appendChild(toast);
    if (duration > 0) setTimeout(close, duration);
    return toast;
  },

  success(title, msg, dur) { return this.show(title, msg, 'success', dur); },
  error(title, msg, dur)   { return this.show(title, msg, 'error', dur); },
  warning(title, msg, dur) { return this.show(title, msg, 'warning', dur); },
  info(title, msg, dur)    { return this.show(title, msg, 'info', dur); },
};

/* ── Push Notifications ── */
const PushNotifications = {
  _swRegistration: null,
  _subscription: null,

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    try {
      this._swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const existingSub = await this._swRegistration.pushManager.getSubscription();
      if (existingSub) {
        this._subscription = existingSub;
        return true;
      }
      return true;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
      return false;
    }
  },

  async requestPermission() {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  async subscribe() {
    if (!this._swRegistration) return null;
    const granted = await this.requestPermission();
    if (!granted) return null;

    try {
      // In production, generate VAPID keys and use them here
      // For demo, we use a basic push setup
      const subscription = await this._swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJkHAPDeleteThisAndReplaceWithRealVapidKey'
        ),
      });
      this._subscription = subscription;
      return subscription;
    } catch {
      // Fallback to basic notification
      return null;
    }
  },

  showLocalNotification(title, options = {}) {
    if (!this._swRegistration) {
      if (Notification.permission === 'granted') {
        new Notification(title, { icon: '/manifest.json', ...options });
      }
      return;
    }
    this._swRegistration.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      ...options,
    });
  },

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  },
};

/* ── In-app Notification Manager ── */
const NotificationManager = {
  _channel: null,
  _badge: null,

  async init(userId) {
    this._badge = document.getElementById('notif-badge');
    await this._updateBadge(userId);

    // Subscribe to real-time notifications
    this._channel = DB.subscribeToNotifications(userId, (payload) => {
      const notif = payload.new;
      this._handleNewNotification(notif);
    });
  },

  async _updateBadge(userId) {
    const count = await DB.getUnreadNotificationCount(userId);
    this._setBadge(count);
  },

  _setBadge(count) {
    if (!this._badge) return;
    if (count > 0) {
      this._badge.textContent = count > 99 ? '99+' : String(count);
      this._badge.style.display = 'flex';
    } else {
      this._badge.style.display = 'none';
    }
  },

  _handleNewNotification(notif) {
    // Show toast
    Toasts.info(notif.title, notif.body, 5000);

    // Show browser notification
    PushNotifications.showLocalNotification(notif.title, { body: notif.body });

    // Update badge
    const currentCount = parseInt(this._badge?.textContent || '0', 10);
    this._setBadge(currentCount + 1);

    Utils.emit('notification:new', notif);
  },

  async notifyNewJob(userId, job, matchScore) {
    const notif = {
      user_id: userId,
      job_id: job.id,
      type: 'new_job',
      title: `New match: ${job.title}`,
      body: `${job.company_name} — ${matchScore}% match`,
      action_url: `jobs.html?id=${job.id}`,
    };
    return DB.createNotification(notif);
  },

  destroy() {
    if (this._channel) DB.unsubscribe(this._channel);
  },
};
