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
  | "settings_connectors"
  | "settings_models"
  | "settings_billing"
  | "settings_help"
  | "settings_files"
  | "settings_preferences"
  | "settings_notifications"
  | "settings_security"
  | "welcome"
  | "slack_setup"
  | "share_view"
  | `onboarding_${string}`;

// ── Layer 4: feature_used (one event, controlled feature-name list) ──────────────
// The controlled list from the setup doc. Tracking a new feature = adding one name
// here (in the doc first), NOT designing a new event.
export type FeatureName =
  | "model_selector_manual"
  | "compare_models"
  | "search"
  | "share_button"
  | "pin_drag"
  | "highlight_filter"
  | "pin_folder_organize"
  | "agent_template_browsed"
  | "agent_edited"
  | "agent_enhance_instructions"
  | "project_instructions_added"
  | "project_agent_attached"
  | "context_panel_opened"
  | "effort_level_changed"
  | "permission_level_changed"
  | "schedule_created"
  | "voice_input"
  | "flashcards"
  | "document_download"
  | "settings_help_opened"
  | "regenerate"
  | "output_viewed";

// ── Layer 3: browser-originating decision events ─────────────────────────────────
// Only the events that actually originate in the browser live here. Run lifecycle,
// cost stamps, Slack activity and Stripe-webhook events (plan_changed, plan_limit_hit,
// workflow_*, brain_*, automation_*, memory_referenced, report_generated) are emitted
// by the BACKEND door — see docs/mixpanel-backend-contract.md. Call-site wiring for
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
  | "brain_run_stopped"
  | "project_created"
  | "team_member_invited"
  | "share_created"
  | "connector_connect_attempted"
  | "credit_cap_set"
  | "model_toggled_off"
  | "checkout_started";

/** Metadata-only properties. The type forbids nothing at runtime, but callers must
 *  pass IDs / enumerated values only — never message content, prompt text, titles, or
 *  any AI-generated free text (the doc's hard privacy rule). */
export type EventProps = Record<string, string | number | boolean | undefined>;

// ── Typed emit helpers ───────────────────────────────────────────────────────────

/** Layer 1 — fire on every screen change. */
export function trackScreenView(screen: ScreenName): void {
  track("screen_viewed", { screen });
}

/** Layer 4 — fire when a controlled feature is used. */
export function trackFeature(feature: FeatureName, props?: EventProps): void {
  track("feature_used", { feature, ...props });
}

/** Layer 3 — fire a browser-originating decision event. */
export function trackBrowserEvent(event: BrowserEvent, props?: EventProps): void {
  track(event, props);
}
