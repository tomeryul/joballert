/* ============================================
   LinkedIn Provider
   Uses LinkedIn guest jobs API (no auth required).
   Searches specifically in Israel.
   ============================================ */

class LinkedInProvider extends BaseProvider {
  constructor() {
    super({ id: 'linkedin', name: 'LinkedIn', rateLimit: 2000 });
    // LinkedIn geoId for Israel
    this._geoId = '101620260';
  }

  async fetchJobs(query = {}) {
    const keywords = encodeURIComponent(
      query.keywords || 'software developer engineer'
    );
    const results = [];

    // Fetch up to 2 pages (25 jobs each)
    for (let start = 0; start < 50; start += 25) {
      try {
        const jobs = await this._fetchPage(keywords, start);
        results.push(...jobs);
        if (jobs.length < 25) break;
        await this._sleep(this.rateLimit);
      } catch {
        break;
      }
    }

    return results;
  }

  async _fetchPage(keywords, start) {
    const liUrl = [
      'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search',
      `?keywords=${keywords}`,
      `&location=Israel`,
      `&geoId=${this._geoId}`,
      `&f_TPR=r604800`,  // last 7 days
      `&start=${start}`,
      `&count=25`,
    ].join('');

    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(liUrl)}`;

    const res = await this._throttledFetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];

    const html = await res.text();
    return this._parseCards(html);
  }

  _parseCards(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return [...doc.querySelectorAll('.base-card')].map(card => {
      const title    = card.querySelector('.base-search-card__title')?.textContent?.trim();
      const company  = card.querySelector('.base-search-card__subtitle a, .base-search-card__subtitle')?.textContent?.trim();
      const location = card.querySelector('.job-search-card__location')?.textContent?.trim();
      const url      = card.querySelector('a.base-card__full-link')?.href ||
                       card.querySelector('a[href*="/jobs/view/"]')?.href;
      const dateAttr = card.querySelector('time')?.getAttribute('datetime');

      if (!title || !url) return null;

      return this._normalizeJob({
        title,
        company: company || 'Unknown',
        location: location || 'Israel',
        url,
        date_posted: dateAttr || null,
        description: '',
      });
    }).filter(Boolean);
  }
}
