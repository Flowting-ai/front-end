# Frontend Features

Inferred from the route structure in `src/app` and component names in `src/components`. Not yet verified against page code.

## Core
- **Chat** (`chat`, `chats`, `chat-shares`): AI chat with streaming, message bubbles, context indicator and panel, browser panel, approval cards, link side panels. Chat selection, move to project, shared chats.
- **Compare** (`compare`): side-by-side model comparison.
- **Agents** (`agent`, `agents`): agent editor, agents panel, share modal, change/fix agent model flows.
- **Projects** (`project`, `projects`): create, edit, delete, leave projects; move chats into them.
- **Templates** (`template`): reusable chat/prompt templates.
- **Schedules** (`schedules`): scheduled runs.
- **Pinboard** (`Pinboard`, `Pin`, `PinCategory`, `PinCommentField`): pins, categories, comments. Highlights (`HighlightCard`, `HighlightPanel`) appear related.
- **Global search** (`GlobalSearchModal`).

## Integrations
- **Connectors** (`connectors`): catalog, browse, status, paused state, requests.
- **Slack** (`slack`, `souvenir-slack`): Slack connector and sidebar entry.
- **AI Models view** (`AiModelsView`, `ModelFeaturedCard`): model selection and catalog.

## Teams and Accounts
- **Auth** (`auth`): Auth0 login, logout, access token.
- **Onboarding** (`onboarding`, `welcome`): onboarding flow, Meta Pixel tracking.
- **Organizations** (`org`, `org-invite`, `team-invite`): invites, leave workspace, org badges.
- **Settings** (`settings`): account menu and settings pages.
- **Credits and billing**: credit status banner, exhaustion banner, inline credit notice, card brand logos, contact sales modal.

## Other
- **Analytics** (`Analytics`, `ChartCard`, `DeltaPill`, `DateRangePill`): usage dashboards.
- **Notifications** (`NotificationBell`, `NotificationPanel`).
- **Prompt enhancement** (`EnhancePromptField` and related components).
- **Personas** (`PersonaCard`, `api/persona-chat`) and **Share** (`share`).
- **Internal / API routes**: `dev`, `reasoning-verify`, `api/chat`, `api/backend`, `api/download`, `api/lab`, `api/template`, `dispatch`.
