/* ============================================
   JOBALLERT — Auth Controller
   ============================================ */

const Auth = {
  _user: null,
  _profile: null,
  _settings: null,

  async init() {
    const session = await DB.getSession();
    if (session) {
      this._user = session.user;
      await this._loadUserData();
    }

    DB.onAuthChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this._user = session.user;
        await this._loadUserData();
        Utils.emit('auth:signed_in', this._user);
      } else if (event === 'SIGNED_OUT') {
        this._user = null;
        this._profile = null;
        this._settings = null;
        Utils.emit('auth:signed_out');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        this._user = session.user;
      }
    });
  },

  async _loadUserData() {
    if (!this._user) return;
    const [profileRes, settingsRes] = await Promise.all([
      DB.getProfile(this._user.id),
      DB.getSettings(this._user.id),
    ]);
    this._profile = profileRes.data || {};
    this._settings = settingsRes.data || {};
  },

  get user() { return this._user; },
  get profile() { return this._profile; },
  get settings() { return this._settings; },
  get isLoggedIn() { return !!this._user; },

  getEffectiveProfile() {
    return { ...CONFIG.DEFAULT_PROFILE, ...(this._profile || {}) };
  },

  requireAuth() {
    if (!this._user) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  redirectIfAuth() {
    if (this._user) {
      window.location.href = 'dashboard.html';
    }
  },

  async signUp(email, password, fullName) {
    const { data, error } = await DB.signUp(email, password, fullName);
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await DB.signIn(email, password);
    if (error) throw error;
    this._user = data.user;
    await this._loadUserData();
    return data;
  },

  async signInWithGoogle() {
    const { error } = await DB.signInWithGoogle();
    if (error) throw error;
  },

  async signInWithGitHub() {
    const { error } = await DB.signInWithGitHub();
    if (error) throw error;
  },

  async signOut() {
    await DB.signOut();
    Utils.store.clear();
    window.location.href = 'index.html';
  },

  async updateProfile(updates) {
    if (!this._user) return;
    const { data, error } = await DB.upsertProfile(this._user.id, updates);
    if (error) throw error;
    this._profile = data;
    AIMatcher.clearCache();
    return data;
  },

  async updateSettings(updates) {
    if (!this._user) return;
    const { data, error } = await DB.upsertSettings(this._user.id, updates);
    if (error) throw error;
    this._settings = data;
    return data;
  },
};
