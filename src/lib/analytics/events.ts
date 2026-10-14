// The analytics vocabulary — the single source of truth for event and property names
// the browser door emits. Adding coverage = adding a name here first (per the setup
// doc's standing rule), then wiring the call site. All names follow the Mixpanel
// skill's conventions: snake_case, object_verb, lowercase enum values, no free text.

import { track } from "./mixpanel";

// ── Layer 1: screen views ───────────────────────────────────────────────────────
// Screen names are CONCEPTS, not routes — a redesign keeps the name and re-points the
// mapping (see screens.ts). Onboarding steps are open-ended (`onboarding_<step>`).
export type ScreenName =
  | "chat"
  | "chat_history"
  | "brain"
  | "agent_library"
  | "agent_configure"
  | "agent_onboarding"
  | "projects"
  | "project_detail"
  | "teams"
  | "org_manage"
  | "settings_profile"
  | "settings_models"
  | "settings_billing"
  | "settings_help"
  | "settings_files"
  | "library"
  | "library_file"
  | "settings_preferences"
  | "settings_notifications"
  | "settings_security"
  | "welcome"
  | "slack_setup"
  | "share_view"
  | "template_view"
  | `onboarding_${string}`;

// ── Layer 4: feature_used (one event, controlled feature-name list) ──────────────
// The controlled list from the setup doc. Tracking a new feature = adding one name
// here (in the doc first), NOT designing a new event.
export type FeatureName =
  | "model_selector_manual"
  | "compare_models"
  | "search"
  | "search_result_opened"
  | "share_button"
  | "pin_drag"
  | "highlight_filter"
  | "pin_folder_organize"
  | "agent_template_browsed"
  | "agent_edited"
  | "agent_tested"
  | "agent_enhance_instructions"
  | "project_instructions_added"
  | "project_agent_attached"
  | "context_panel_opened"
  | "effort_level_changed"
  | "permission_level_changed"
  | "schedule_created"
  | "schedule_edit_started"
  | "voice_input"
  | "flashcards"
  | "document_download"
  | "settings_help_opened"
  | "regenerate"
  | "output_viewed"
  | "library";

// ── Layer 3: browser-originating decision events ─────────────────────────────────
// Only the events that actually originate in the browser live here. Run lifecycle,
// cost stamps, Slack activity and Stripe-webhook events (plan_changed, plan_limit_hit,
// workflow_*, brain_*, automation_*, memory_referenced, report_generated) are emitted
// by the BACKEND door — see docs/analytics/mixpanel-backend-contract.md. Call-site wiring for
// these is a follow-up; the names are declared now so future wiring is type-checked.
export type BrowserEvent =
  | "signup_completed"
  | "onboarding_step_completed"
  | "activation_milestone"
  | "chat_message_sent"
  | "pin_created"
  | "highlight_created"
  | "agent_created"
  | "agent_wizard_abandoned"
  | "agent_published"
  | "agent_shared"
  | "agent_save_failed"
  | "brain_run_stopped"
  | "project_created"
  | "project_deleted"
  | "project_left"
  | "project_member_added"
  | "chat_moved_to_project"
  | "team_member_invited"
  | "org_invite_revoked"
  | "org_member_removed"
  | "org_left"
  | "org_deleted"
  | "share_created"
  | "share_preview_viewed"
  | "share_expired_seen"
  | "share_accepted"
  | "share_forked"
  | "share_revoked"
  | "connector_connect_attempted"
  | "connector_connected"
  | "connector_connect_failed"
  | "connector_connect_cancelled"
  | "connector_unlinked"
  | "connector_share_changed"
  | "credit_cap_set"
  | "model_toggled_off"
  | "model_toggled_on"
  | "model_selected"
  | "auth_refresh_failed"
  | "auth_session_expired"
  | "auth_session_timed_out"
  | "web_vital"
  | "usage_csv_exported"
  | "schedule_paused"
  | "schedule_resumed"
  | "schedule_run_now"
  | "schedule_deleted"
  | "schedule_copied"
  | "model_fallback"
  | "checkout_started"
  | "checkout_failed"
  | "checkout_confirmed"
  | "subscription_canceled"
  | "subscription_resumed"
  | "billing_portal_opened"
  | "trial_claimed"
  | "prompt_enhance_outcome"
  | "profile_updated"
  | "tone_changed"
  | "theme_changed";

/** Metadata-only properties. The type forbids nothing at runtime, but callers must
 *  pass IDs / enumerated values only — never message content, prompt text, titles, or
 *  any AI-generated free text (the doc's hard privacy rule). */
export type EventProps = Record<string, string | number | boolean | undefined>;

type NoProps = Record<string, never>;

/**
 * Per-event property shapes, mirroring the table in
 * docs/analytics/mixpanel-frontend-implementation.md. IDs, slugs, enums,
 * counts and booleans only — never free text. An event missing here falls
 * back to `EventProps`; add it when its call site settles.
 */
export interface BrowserEventPropMap {
  chat_message_sent: { has_agent: boolean; model_pick: string; model_id?: string; web_search?: boolean; reasoning?: boolean | string; attachment_count: number; pin_count: number; queued?: boolean };
  pin_created: { source: "chat" | "brain" };
  highlight_created: { source: "chat" };
  agent_created: { from_template: boolean; template_slug?: string };
  agent_wizard_abandoned: { last_step: string | number };
  agent_published: NoProps;
  agent_shared: { share_type: string };
  project_created: { team_shared: boolean };
  project_deleted: NoProps;
  project_left: { as_owner: boolean; alone_action?: string };
  project_member_added: { count: number };
  chat_moved_to_project: NoProps;
  team_member_invited: { role: string; count: number; from_project: boolean };
  org_invite_revoked: NoProps;
  org_member_removed: NoProps;
  org_left: { with_successor: boolean };
  org_deleted: NoProps;
  share_created: { kind: "user" | "team" | "project" | "link" };
  share_accepted: { kind: "agent" };
  share_forked: { kind: "chat" };
  share_revoked: { kind: "agent" | "chat" };
  signup_completed: { account_type?: string; invited_by_org: boolean };
  onboarding_step_completed: { step: string };
  checkout_started: { from_plan?: string; to_plan: string; source?: string };
  checkout_failed: { from_plan?: string; to_plan: string; source?: string };
  checkout_confirmed: { source: string };
  subscription_canceled: NoProps;
  subscription_resumed: NoProps;
  trial_claimed: NoProps;
  profile_updated: { name_changed: boolean; avatar_changed: boolean };
  tone_changed: { tone: string };
  theme_changed: { mode: string };
  model_toggled_off: { model_id: string };
  model_toggled_on: { model_id: string };
  model_selected: { model_id?: string };
  model_fallback: { from_model_id?: string; to_model_id?: string };
  credit_cap_set: { has_cap: boolean };
  connector_connect_attempted: { connector: string };
  connector_connected: { connector: string; reconnect: boolean; shared: boolean };
  connector_connect_failed: { connector: string; reason: string };
  connector_connect_cancelled: { connector: string };
  connector_unlinked: NoProps;
  connector_share_changed: { shared: boolean };
  auth_refresh_failed: { suppressed: boolean };
  auth_session_expired: NoProps;
  auth_session_timed_out: { reason: "idle" | "max" };
  schedule_paused: NoProps;
  schedule_resumed: NoProps;
  schedule_run_now: NoProps;
  schedule_deleted: NoProps;
  schedule_copied: NoProps;
  usage_csv_exported: { rows: number };
  web_vital: { metric: string; value: number; rating: string; screen: string; navigation?: string };
}

/** The props an event takes: its typed shape when listed, else the loose `EventProps`. */
export type BrowserEventProps<E extends BrowserEvent> = E extends keyof BrowserEventPropMap ? BrowserEventPropMap[E] : EventProps;

// ── Typed emit helpers ───────────────────────────────────────────────────────────

/** Layer 1 — fire on every screen change. */
export function trackScreenView(screen: ScreenName, props?: { tab?: string }): void {
  track("screen_viewed", { screen, ...props });
}

/** Layer 4 — fire when a controlled feature is used. */
export function trackFeature(feature: FeatureName, props?: EventProps): void {
  track("feature_used", { feature, ...props });
}

/** Layer 3 — fire a browser-originating decision event. */
export function trackBrowserEvent<E extends BrowserEvent>(event: E, props?: BrowserEventProps<E>): void {
  track(event, props as EventProps | undefined);
}
