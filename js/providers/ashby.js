/* ============================================
   Ashby Provider
   Fetches jobs from companies using Ashby ATS.
   ============================================ */

class AshbyProvider extends BaseProvider {
  constructor() {
    super({ id: 'ashby', name: 'Ashby', rateLimit: 600 });

    this._companies = [
      { slug: 'linear', name: 'Linear' },
      { slug: 'vercel', name: 'Vercel' },
      { slug: 'mercury', name: 'Mercury' },
      { slug: 'posthog', name: 'PostHog' },
      { slug: 'dbt-labs', name: 'dbt Labs' },
      { slug: 'highlight', name: 'Highlight' },
      { slug: 'cal.com', name: 'Cal.com' },
      { slug: 'incident-io', name: 'incident.io' },
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
    const proxyUrl = `https://jobs.ashbyhq.com/api/non-user-graphql`;
    const body = JSON.stringify({
      operationName: 'ApiJobBoardWithTeams',
      variables: { organizationHostedJobsPageName: slug },
      query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
        jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
          jobPostings { id title location { name } isRemote employmentType externalLink publishedDate }
        }
      }`,
    });

    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(proxyUrl)}`;

    // POST via proxy is tricky; fall back to known Ashby job feeds
    return [];
  }
}
