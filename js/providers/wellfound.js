/* ============================================
   Wellfound (AngelList) Provider
   Uses Wellfound's public job search RSS/API.
   ============================================ */

class WellfoundProvider extends BaseProvider {
  constructor() {
    super({ id: 'wellfound', name: 'Wellfound', rateLimit: 1000 });
  }

  async fetchJobs(query = {}) {
    const results = [];

    const searches = [
      { role: 'software-engineer' },
      { role: 'full-stack-engineer' },
      { role: 'backend-engineer' },
      { role: 'frontend-engineer' },
    ];

    for (const search of searches) {
      try {
        const jobs = await this._fetchByRole(search.role);
        results.push(...jobs);
        await this._sleep(this.rateLimit);
      } catch {
        // Continue on error
      }
    }

    return results;
  }

  async _fetchByRole(role) {
    const params = new URLSearchParams({ role, location: 'israel' });

    const proxyUrl = `https://wellfound.com/jobs.json?${params}`;
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(proxyUrl)}`;

    try {
      const res = await this._throttledFetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];

      const data = await res.json();
      const jobs = data.jobs || data.startupRoles || [];

      return jobs.map(job => this._normalizeJob({
        id: job.id,
        title: job.title || job.role,
        company: job.startup?.name || job.company?.name || '',
        location: job.locationNames || job.location,
        url: `https://wellfound.com/jobs/${job.id}`,
        description: job.description,
        date_posted: job.postedDate || job.created_at,
        salary_min: job.compensation?.min,
        salary_max: job.compensation?.max,
        skills: job.skills?.map(s => s.name) || [],
        remote: job.remote,
      }));
    } catch {
      return [];
    }
  }
}
