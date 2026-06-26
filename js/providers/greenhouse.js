/* ============================================
   Greenhouse Provider
   Fetches jobs from companies using Greenhouse ATS.
   Uses public Greenhouse API (no auth required).
   ============================================ */

class GreenhouseProvider extends BaseProvider {
  constructor() {
    super({ id: 'greenhouse', name: 'Greenhouse', rateLimit: 500 });

    // Israeli tech companies using Greenhouse ATS
    this._companies = [
      { slug: 'monday',       name: 'monday.com' },
      { slug: 'fiverr',       name: 'Fiverr' },
      { slug: 'jfrog',        name: 'JFrog' },
      { slug: 'cyberark',     name: 'CyberArk' },
      { slug: 'taboola',      name: 'Taboola' },
      { slug: 'outbrain',     name: 'Outbrain' },
      { slug: 'snyk',         name: 'Snyk' },
      { slug: 'bigid',        name: 'BigID' },
      { slug: 'walkme',       name: 'WalkMe' },
      { slug: 'payoneer',     name: 'Payoneer' },
      { slug: 'radware',      name: 'Radware' },
      { slug: 'imperva',      name: 'Imperva' },
      { slug: 'amdocs',       name: 'Amdocs' },
      { slug: 'sito',         name: 'SitoMobile' },
    ];
  }

  async fetchJobs(query = {}) {
    const results = [];
    const keywords = (query.keywords || 'software developer engineer').toLowerCase();

    for (const company of this._companies) {
      try {
        const jobs = await this._fetchCompanyJobs(company.slug, company.name, keywords);
        results.push(...jobs);
        await this._sleep(this.rateLimit);
      } catch {
        // Skip company on error
      }
    }

    return results;
  }

  async _fetchCompanyJobs(slug, companyName, keywords) {
    const proxyUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

    // Use a CORS proxy since this runs client-side
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(proxyUrl)}`;

    const res = await this._throttledFetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs
      .filter(job => {
        const text = (job.title + ' ' + (job.content || '')).toLowerCase();
        return keywords.split(' ').some(kw => text.includes(kw));
      })
      .map(job => this._normalizeJob({
        ...job,
        company: companyName,
        url: job.absolute_url,
        description: job.content,
        location: job.location?.name,
        date_posted: job.updated_at,
      }))
      .filter(job => job.url);
  }
}
