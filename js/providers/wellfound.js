/* ============================================
   Wellfound (AngelList) Provider
   Uses Wellfound's public job search RSS/API.
   ============================================ */

class WellfoundProvider extends BaseProvider {
  constructor() {
    super({ id: 'wellfound', name: 'Wellfound', rateLimit: 1000 });
  }

  async fetchJobs(query = {}) {
    const keywords = query.keywords || 'software engineer developer';
    const remote = query.remote !== false;
    const results = [];

    // Wellfound has a public API for job listings
    const searches = [
      { role: 'software-engineer', label: 'Software Engineer' },
      { role: 'full-stack-engineer', label: 'Full Stack Engineer' },
      { role: 'backend-engineer', label: 'Backend Engineer' },
      { role: 'frontend-engineer', label: 'Frontend Engineer' },
    ];

    for (const search of searches) {
      try {
        const jobs = await this._fetchByRole(search.role, remote);
        results.push(...jobs);
        await this._sleep(this.rateLimit);
      } catch {
        // Continue on error
      }
    }

    return results;
  }

  async _fetchByRole(role, remote) {
    const params = new URLSearchParams({
      role,
      ...(remote ? { remote: '1' } : {}),
    });

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
