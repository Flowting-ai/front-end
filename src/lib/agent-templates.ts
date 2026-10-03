/**
 * "Recommended for you" on the templates page.
 *
 * There is no backend personalisation for agent templates yet, so the ranking is
 * done on the client from signals the app already has: which apps the user has
 * connected, and which agents they already have. It is deliberately simple and
 * explainable — each recommendation carries the reason it was picked.
 */

/** Connector-name fragments that make a template more useful, per template. */
export const TEMPLATE_AFFINITY: Readonly<Record<string, readonly string[]>> = {
  'Customer Support':    ['zendesk', 'intercom', 'freshdesk', 'helpscout', 'gmail', 'outlook', 'slack', 'servicenow', 'crisp'],
  'Sales':               ['hubspot', 'salesforce', 'pipedrive', 'apollo', 'zoho', 'close', 'outreach', 'gong'],
  'Legal':               ['docusign', 'ironclad', 'pandadoc', 'clio', 'googledrive', 'dropbox', 'box'],
  'Research':            ['notion', 'googledrive', 'confluence', 'arxiv', 'perplexity', 'zotero', 'mendeley'],
  'Content Writer':      ['wordpress', 'webflow', 'ghost', 'medium', 'googledocs', 'notion', 'contentful', 'buffer'],
  'Code Review':         ['github', 'gitlab', 'bitbucket', 'linear', 'jira', 'sentry', 'vercel'],
  'Onboarding':          ['bamboohr', 'workday', 'gusto', 'rippling', 'slack', 'notion', 'confluence', 'lattice'],
  'Marketing':           ['mailchimp', 'hubspot', 'klaviyo', 'googleanalytics', 'facebook', 'linkedin', 'instagram', 'semrush', 'canva'],
  'Data Analyst':        ['googlesheets', 'airtable', 'bigquery', 'snowflake', 'postgres', 'mysql', 'mixpanel', 'amplitude', 'tableau', 'looker', 'excel'],
  'HR & Recruiting':     ['greenhouse', 'lever', 'workable', 'bamboohr', 'workday', 'linkedin', 'ashby', 'gusto'],
  'Executive Assistant': ['googlecalendar', 'gmail', 'outlook', 'calendly', 'slack', 'zoom', 'googlemeet', 'microsoftteams'],
  'Education':           ['googleclassroom', 'canvas', 'moodle', 'blackboard', 'googledocs', 'notion'],
  'Productivity':        ['asana', 'trello', 'notion', 'clickup', 'linear', 'jira', 'todoist', 'monday', 'basecamp'],
  'Tutoring':            ['googleclassroom', 'canvas', 'khanacademy', 'quizlet', 'anki'],
  'Web QA':              ['browserstack', 'github', 'sentry', 'jira', 'linear', 'lambdatest', 'playwright'],
}

/** Shown first when nothing connected points anywhere. */
export const POPULAR_TEMPLATES: readonly string[] = ['Customer Support', 'Research', 'Content Writer', 'Executive Assistant']

export interface TemplateRecommendation {
  name:   string
  /** Connected apps that made this a good fit (display names). Empty for the popular fallback. */
  because: string[]
}

export interface RecommendInput {
  /** Every template name, in the gallery's own order (used to break ties). */
  templates:      readonly string[]
  /** The user's connected apps. */
  linked:         ReadonlyArray<{ slug: string; displayName: string }>
  /** Names of agents the user already has — a template for the same thing is skipped. */
  existingAgents: readonly string[]
  /** The preset display name per template (e.g. Legal → "Legal Advisor"). */
  presetNames:    Readonly<Record<string, string>>
  limit?:         number
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Short fragments ("box", "close") must be the whole name, or they match "sandbox" and "enclosed". */
function matchesFragment(name: string, fragment: string): boolean {
  return fragment.length <= 5 ? name === fragment : name.includes(fragment)
}

/** True when the user already has an agent that is this template. */
export function alreadyHasTemplate(
  template: string,
  presetName: string | undefined,
  existingAgents: readonly string[],
): boolean {
  const names = new Set(existingAgents.map(normalize))
  return names.has(normalize(template)) || (!!presetName && names.has(normalize(presetName)))
}

/**
 * Templates ranked by how many of the user's connected apps they work with,
 * best first. Templates with no match are left out; when nothing matches at all
 * the popular starting points are returned with no reason attached.
 */
export function recommendTemplates(input: RecommendInput): { items: TemplateRecommendation[]; personalized: boolean } {
  const { templates, linked, existingAgents, presetNames, limit = 6 } = input
  const available = templates.filter(name => !alreadyHasTemplate(name, presetNames[name], existingAgents))

  const linkedKeys = linked.map(item => ({ key: normalize(item.slug), key2: normalize(item.displayName), label: item.displayName }))

  const scored = available
    .map((name, order) => {
      const wanted = TEMPLATE_AFFINITY[name] ?? []
      const matches = linkedKeys.filter(item =>
        wanted.some(fragment => matchesFragment(item.key, fragment) || matchesFragment(item.key2, fragment)),
      )
      return { name, order, because: [...new Set(matches.map(match => match.label))] }
    })
    .filter(entry => entry.because.length > 0)
    .sort((a, b) => b.because.length - a.because.length || a.order - b.order)
    .slice(0, limit)
    .map(({ name, because }) => ({ name, because }))

  if (scored.length > 0) return { items: scored, personalized: true }

  const fallback = POPULAR_TEMPLATES.filter(name => available.includes(name)).map(name => ({ name, because: [] as string[] }))
  return { items: fallback, personalized: false }
}
