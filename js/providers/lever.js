/* ============================================
   Lever Provider
   Fetches jobs from companies using Lever ATS.
   Uses public Lever posting API (no auth required).
   ============================================ */

class LeverProvider extends BaseProvider {
  constructor() {
    super({ id: 'lever', name: 'Lever', rateLimit: 500 });

    // Israeli tech companies using Lever ATS
    this._companies = [
      { slug: 'riskified',      name: 'Riskified' },
      { slug: 'lightricks',     name: 'Lightricks' },
      { slug: 'forter',         name: 'Forter' },
      { slug: 'next-insurance', name: 'Next Insurance' },
      { slug: 'pagaya',         name: 'Pagaya' },
      { slug: 'guesty',         name: 'Guesty' },
      { slug: 'ironSource',     name: 'ironSource' },
      { slug: 'varonis',        name: 'Varonis' },
      { slug: 'salto',          name: 'Salto' },
      { slug: 'lusha',          name: 'Lusha' },
      { slug: 'talkdesk',       name: 'Talkdesk' },
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
        // Skip on error
      }
    }

    return results;
  }

  async _fetchCompanyJobs(slug, companyName, keywords) {
    const proxyUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(proxyUrl)}`;

    const res = await this._throttledFetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const jobs = await res.json();

    return (Array.isArray(jobs) ? jobs : [])
      .filter(job => {
        const text = (job.text + ' ' + (job.descriptionPlain || '')).toLowerCase();
        return keywords.split(' ').some(kw => text.includes(kw));
      })
      .map(job => this._normalizeJob({
        ...job,
        title: job.text,
        company: companyName,
        url: job.hostedUrl,
        description: job.descriptionPlain || job.description,
        location: job.categories?.location,
        date_posted: job.createdAt ? new Date(job.createdAt).toISOString() : null,
        experience_level: job.categories?.commitment,
      }))
      .filter(job => job.url);
  }
}
