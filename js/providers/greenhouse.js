/* ============================================
   Greenhouse Provider
   Fetches jobs from companies using Greenhouse ATS.
   Uses public Greenhouse API (no auth required).
   ============================================ */

class GreenhouseProvider extends BaseProvider {
  constructor() {
    super({ id: 'greenhouse', name: 'Greenhouse', rateLimit: 500 });

    // Companies known to use Greenhouse (add more as needed)
    this._companies = [
      { slug: 'databricks', name: 'Databricks' },
      { slug: 'figma', name: 'Figma' },
      { slug: 'notion', name: 'Notion' },
      { slug: 'ramp', name: 'Ramp' },
      { slug: 'retool', name: 'Retool' },
      { slug: 'scale', name: 'Scale AI' },
      { slug: 'benchling', name: 'Benchling' },
      { slug: 'asana', name: 'Asana' },
      { slug: 'segment', name: 'Segment' },
      { slug: 'brex', name: 'Brex' },
      { slug: 'gusto', name: 'Gusto' },
      { slug: 'flexport', name: 'Flexport' },
      { slug: 'mixpanel', name: 'Mixpanel' },
      { slug: 'plaid', name: 'Plaid' },
      { slug: 'intercom', name: 'Intercom' },
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
