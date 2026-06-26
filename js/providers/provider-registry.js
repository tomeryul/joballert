/* ============================================
   JOBALLERT — Provider Registry
   Manages all job providers
   ============================================ */

class ProviderRegistry {
  constructor() {
    this._providers = new Map();
    this._scanInProgress = false;
  }

  register(provider) {
    this._providers.set(provider.id, provider);
    return this;
  }

  get(id) { return this._providers.get(id); }
  getAll() { return [...this._providers.values()]; }
  getEnabled() { return this.getAll().filter(p => p.enabled); }

  enable(id) {
    const p = this._providers.get(id);
    if (p) p.enabled = true;
  }

  disable(id) {
    const p = this._providers.get(id);
    if (p) p.enabled = false;
  }

  setEnabled(ids) {
    this.getAll().forEach(p => {
      p.enabled = ids.includes(p.id);
    });
  }

  // ── Scan ──────────────────────────────────
  async scan(query = {}, onProgress = null) {
    if (this._scanInProgress) return { success: false, message: 'Scan already in progress' };
    this._scanInProgress = true;

    const results = {
      totalFound: 0,
      newJobs: 0,
      updatedJobs: 0,
      errors: [],
      byProvider: {},
    };

    const enabled = this.getEnabled();
    Utils.emit('scan:started', { providers: enabled.length });

    for (const provider of enabled) {
      try {
        Utils.emit('scan:provider_start', { provider: provider.id });
        onProgress?.({ provider: provider.name, status: 'scanning' });

        const jobs = await provider.fetchJobs(query);
        const normalized = jobs
          .filter(j => j.url && j.title && j.company_name)
          .filter(j => provider.isIsraelOnly || provider._isIsraeliOrRemote(j));

        results.byProvider[provider.id] = { found: normalized.length, new: 0, errors: 0 };
        results.totalFound += normalized.length;

        if (normalized.length > 0) {
          const { error, data } = await DB.insertJobs(normalized);
          if (!error && data) {
            results.newJobs += data.length;
            results.byProvider[provider.id].new = data.length;
          }
        }

        Utils.emit('scan:provider_done', { provider: provider.id, count: normalized.length });
        onProgress?.({ provider: provider.name, status: 'done', count: normalized.length });

      } catch (err) {
        results.errors.push({ provider: provider.id, error: err.message });
        results.byProvider[provider.id] = { found: 0, new: 0, errors: 1 };
        Utils.emit('scan:provider_error', { provider: provider.id, error: err.message });
      }
    }

    this._scanInProgress = false;
    Utils.emit('scan:complete', results);
    return results;
  }
}

// ── Singleton Instance ─────────────────────
const providerRegistry = new ProviderRegistry();

// Register all providers
providerRegistry
  .register(new LinkedInProvider())
  .register(new DrushimProvider())
  .register(new GreenhouseProvider())
  .register(new LeverProvider())
  .register(new AshbyProvider())
  .register(new WellfoundProvider());
