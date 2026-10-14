/**
 * One query-key factory for the app. Conventions:
 *
 * - Each feature has a namespace shaped `all → lists → list(params) → detail(id) → sub-resource`,
 *   so invalidating a prefix (e.g. `billing.all(org)`) also hits everything under it.
 * - Workspace data is scoped by org (`orgScope`), so an org switch can never show
 *   another workspace's cached data. User-level data (`me`, `models`) is not.
 * - Feature slices are added here as each feature moves to React Query.
 *   `libraryKeys` and the persona keys predate this file and are re-exported unchanged.
 */

export { libraryKeys } from "@/lib/library/keys";
export { PERSONAS_QUERY_KEY, PERSONA_REPOS_QUERY_KEY, personaDetailQueryKey } from "@/lib/api/persona-cache";

/** The cache scope for workspace data: the org id, or "personal" for individual accounts. */
export function orgScope(orgId: string | null | undefined): string {
  return orgId || "personal";
}

export const queryKeys = {
  /** GET /users/me — the profile, which also carries the individual credit balance. */
  me: () => ["me"] as const,

  /** The sidebar chat list (infinite query of GET /chats pages). */
  chats: {
    all: () => ["chats"] as const,
    list: () => [...queryKeys.chats.all(), "list"] as const,
    /** One-off first-page read used to pick up a generated title. */
    titleProbe: () => [...queryKeys.chats.all(), "title-probe"] as const,
  },

  /** Model catalogue (user-level: blocked state is per user). */
  models: {
    all: () => ["models"] as const,
  },

  billing: {
    all: (org: string) => ["billing", org] as const,
    info: (org: string) => [...queryKeys.billing.all(org), "info"] as const,
    usage: (org: string) => [...queryKeys.billing.all(org), "usage"] as const,
    invoices: (org: string) => [...queryKeys.billing.all(org), "invoices"] as const,
  },

  /** Projects are per user (every call passes the user id for canEdit). */
  projects: {
    all: (user: string) => ["projects", user] as const,
    list: (user: string) => [...queryKeys.projects.all(user), "list"] as const,
    /** Flat chat list across projects, filled per project by chatLoad. */
    chats: (user: string) => [...queryKeys.projects.all(user), "chats"] as const,
    chatLoad: (user: string, projectId: string) => [...queryKeys.projects.all(user), "chat-load", projectId] as const,
  },
  /** Project members (owner-visible); not per user, logout clears it with everything else. */
  projectMembers: (projectId: string) => ["project-members", projectId] as const,

  /** Automations ("schedules" in the UI). Per user; logout clears them. */
  schedules: {
    all: () => ["schedules"] as const,
    mine: () => [...queryKeys.schedules.all(), "mine"] as const,
    organization: () => [...queryKeys.schedules.all(), "organization"] as const,
    detail: (id: string) => [...queryKeys.schedules.all(), "detail", id] as const,
  },

  /** Connector catalogue, linked accounts and the chat menu's featured apps. */
  connectors: {
    all: () => ["connectors"] as const,
    page: (query: object) => [...queryKeys.connectors.all(), "page", query] as const,
    linked: () => [...queryKeys.connectors.all(), "linked"] as const,
    detail: (slug: string) => [...queryKeys.connectors.all(), "detail", slug] as const,
    categories: () => [...queryKeys.connectors.all(), "categories"] as const,
    featured: () => [...queryKeys.connectors.all(), "featured"] as const,
    search: (q: string) => [...queryKeys.connectors.all(), "search", q] as const,
    /** Sync lookup map for resolveConnector(); not a fetched query. */
    identities: () => ["connector-identities"] as const,
  },

  /** Persona (agent) shares and chat shares. */
  shares: {
    all: () => ["shares"] as const,
    persona: () => [...queryKeys.shares.all(), "persona"] as const,
    dashboard: (days: number) => [...queryKeys.shares.all(), "dashboard", days] as const,
    received: () => [...queryKeys.shares.all(), "received"] as const,
    chat: (chatId: string) => [...queryKeys.shares.all(), "chat", chatId] as const,
  },

  orgs: {
    /** The viewer's org id from GET /organizations, when /users/me lacks org_id. */
    membership: (user: string) => ["org-membership", user] as const,
    all: (org: string) => ["org", org] as const,
    info: (org: string) => [...queryKeys.orgs.all(org), "info"] as const,
    plan: (org: string) => [...queryKeys.orgs.all(org), "plan"] as const,
    members: (org: string) => [...queryKeys.orgs.all(org), "members"] as const,
    audit: (org: string) => [...queryKeys.orgs.all(org), "audit"] as const,
    usage: (org: string) => [...queryKeys.orgs.all(org), "usage"] as const,
    /** GET /organizations/{id}/slack/installation (the sidebar's Slack row). */
    slackStatus: (org: string) => [...queryKeys.orgs.all(org), "slack-status"] as const,
  },
} as const;
