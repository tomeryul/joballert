/* ============================================
   JOBALLERT — Supabase Client
   ============================================ */

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'joballert-auth',
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      }
    );
  }
  return _supabase;
}

const DB = {
  // ── Auth ─────────────────────────────────
  async signUp(email, password, fullName) {
    return getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
  },

  async signIn(email, password) {
    return getSupabase().auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    return getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard.html' },
    });
  },

  async signInWithGitHub() {
    return getSupabase().auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + '/dashboard.html' },
    });
  },

  async signOut() {
    return getSupabase().auth.signOut();
  },

  async getSession() {
    const { data } = await getSupabase().auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await getSupabase().auth.getUser();
    return data.user;
  },

  onAuthChange(callback) {
    return getSupabase().auth.onAuthStateChange(callback);
  },

  // ── User Profile ─────────────────────────
  async getProfile(userId) {
    const { data, error } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async upsertProfile(userId, updates) {
    const { data, error } = await getSupabase()
      .from('user_profiles')
      .upsert({ id: userId, ...updates }, { onConflict: 'id' })
      .select()
      .single();
    return { data, error };
  },

  // ── User Settings ─────────────────────────
  async getSettings(userId) {
    const { data, error } = await getSupabase()
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  async upsertSettings(userId, updates) {
    const { data, error } = await getSupabase()
      .from('user_settings')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .single();
    return { data, error };
  },

  // ── Jobs ─────────────────────────────────
  async getJobs({ search, remote, source, experience, sort = 'date_posted', page = 1, limit = CONFIG.JOBS_PER_PAGE } = {}) {
    let query = getSupabase()
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (search) {
      query = query.textSearch('search_vector', search, { type: 'websearch' });
    }

    if (remote && remote !== 'any') {
      query = query.eq('remote_type', remote);
    }

    if (source && source !== 'all') {
      query = query.eq('source', source);
    }

    if (experience && experience !== 'any') {
      query = query.eq('experience_level', experience);
    }

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    if (sort === 'date_posted') {
      query = query.order('date_posted', { ascending: false, nullsLast: true });
    } else if (sort === 'salary') {
      query = query.order('salary_max', { ascending: false, nullsLast: true });
    }

    return query;
  },

  async getJobById(id) {
    return getSupabase().from('jobs').select('*').eq('id', id).single();
  },

  async getRecentJobs(since) {
    return getSupabase()
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);
  },

  async insertJob(job) {
    return getSupabase().from('jobs').upsert(job, { onConflict: 'url', ignoreDuplicates: true }).select().single();
  },

  async insertJobs(jobs) {
    return getSupabase().from('jobs').upsert(jobs, { onConflict: 'url', ignoreDuplicates: true });
  },

  async markJobExpired(id) {
    return getSupabase().from('jobs').update({ is_active: false }).eq('id', id);
  },

  // ── User Jobs ─────────────────────────────
  async getUserJobs(userId, status = null) {
    let query = getSupabase()
      .from('user_jobs')
      .select(`*, jobs(*)`)
      .eq('user_id', userId);

    if (status) query = query.eq('status', status);

    return query.order('created_at', { ascending: false });
  },

  async getUserJob(userId, jobId) {
    return getSupabase()
      .from('user_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .maybeSingle();
  },

  async upsertUserJob(userId, jobId, updates) {
    const { data, error } = await getSupabase()
      .from('user_jobs')
      .upsert(
        { user_id: userId, job_id: jobId, ...updates },
        { onConflict: 'user_id,job_id' }
      )
      .select()
      .single();
    return { data, error };
  },

  async getUserJobsMap(userId) {
    const { data } = await getSupabase()
      .from('user_jobs')
      .select('job_id, status, match_score')
      .eq('user_id', userId);
    const map = {};
    (data || []).forEach(uj => { map[uj.job_id] = uj; });
    return map;
  },

  // ── Notifications ─────────────────────────
  async getNotifications(userId, limit = 50) {
    return getSupabase()
      .from('notifications')
      .select('*, jobs(title, company_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getUnreadNotificationCount(userId) {
    const { count } = await getSupabase()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  },

  async markNotificationRead(notifId) {
    return getSupabase().from('notifications').update({ is_read: true }).eq('id', notifId);
  },

  async markAllNotificationsRead(userId) {
    return getSupabase().from('notifications').update({ is_read: true }).eq('user_id', userId);
  },

  async createNotification(notification) {
    return getSupabase().from('notifications').insert(notification).select().single();
  },

  // ── Companies ─────────────────────────────
  async getCompanies() {
    return getSupabase().from('companies').select('*').order('name');
  },

  async getCompanyByName(name) {
    return getSupabase().from('companies').select('*').ilike('name', name).maybeSingle();
  },

  // ── Scan Logs ─────────────────────────────
  async getScanLogs(limit = 20) {
    return getSupabase()
      .from('scan_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
  },

  // ── Realtime ─────────────────────────────
  subscribeToJobs(callback) {
    return getSupabase()
      .channel('public:jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, callback)
      .subscribe();
  },

  subscribeToNotifications(userId, callback) {
    return getSupabase()
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, callback)
      .subscribe();
  },

  unsubscribe(channel) {
    if (channel) getSupabase().removeChannel(channel);
  },
};
