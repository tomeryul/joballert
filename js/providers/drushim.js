/* ============================================
   Drushim Provider (דרושים)
   Israel's largest job board.
   Parses the public RSS feeds — no auth needed.
   ============================================ */

class DrushimProvider extends BaseProvider {
  constructor() {
    super({ id: 'drushim', name: 'דרושים', rateLimit: 1200, isIsraelOnly: true });

    // Tech-related category IDs on drushim.co.il
    this._feeds = [
      'https://www.drushim.co.il/rss/cat4/',        // Technology / Computers
      'https://www.drushim.co.il/rss/cat4/?q=%D7%9E%D7%A4%D7%AA%D7%97', // מפתח
      'https://www.drushim.co.il/rss/cat4/?q=developer',
      'https://www.drushim.co.il/rss/cat4/?q=software',
      'https://www.drushim.co.il/rss/cat4/?q=fullstack',
    ];
  }

  async fetchJobs(query = {}) {
    const seen = new Set();
    const results = [];

    for (const feed of this._feeds) {
      try {
        const jobs = await this._fetchFeed(feed);
        for (const job of jobs) {
          if (!seen.has(job.url)) {
            seen.add(job.url);
            results.push(job);
          }
        }
        await this._sleep(this.rateLimit);
      } catch {
        // Skip failed feeds silently
      }
    }

    return results;
  }

  async _fetchFeed(feedUrl) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    const res = await this._throttledFetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];

    const xml = await res.text();
    return this._parseRSS(xml);
  }

  _parseRSS(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return [];

    return [...doc.querySelectorAll('item')].map(item => {
      const raw   = item.querySelector('title')?.textContent?.trim() || '';
      const link  = item.querySelector('link')?.textContent?.trim() || '';
      const desc  = item.querySelector('description')?.textContent?.trim() || '';
      const pub   = item.querySelector('pubDate')?.textContent?.trim() || '';

      if (!link) return null;

      // Drushim titles: "Job Title - Company" or "Job Title | Company"
      let title = raw, company = '';
      for (const sep of [' - ', ' – ', ' | ']) {
        const idx = raw.lastIndexOf(sep);
        if (idx > 0) {
          title   = raw.slice(0, idx).trim();
          company = raw.slice(idx + sep.length).trim();
          break;
        }
      }

      return this._normalizeJob({
        title,
        company: company || 'Unknown',
        location: 'Israel',
        url: link,
        description: this._stripHtmlEntities(desc),
        date_posted: pub ? new Date(pub).toISOString() : null,
      });
    }).filter(j => j && j.title && j.url);
  }

  _stripHtmlEntities(str) {
    return str
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
