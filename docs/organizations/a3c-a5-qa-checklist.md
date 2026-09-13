# A3c–A5 QA Checklist

Manual test checklist for the Team → Organization flattening work (Thread A, sub-threads A3c–A5) in `backend-alignment-execution-map.md`. Companion to A7 (verify) — the automated half (`tsc`, `vitest`, `react-doctor`) is already done; this is the manual half.

## Changes made

| # | Area | Commit(s) | What changed |
|---|---|---|---|
| 1 | `Sidebar/index.tsx` | `c198a54` | Deleted dead `DefaultProjectItems`/`DefaultAgentItems` fallback renderers (unreachable — the real caller always supplies real content) |
| 2 | `teams.ts` / `personas.ts` | `b3f26c1` | Deleted orphaned `fetchPersonaOwnerMap`/`listTeamPersonaShares` — no live caller left |
| 3 | Onboarding invite flow | `551cd8a` | Rewrote `getTeamInviteOnboarding`/`TeamInviteOnboarding` to match the real backend schema (no more team/editor/viewer/credit-cap fields, since none exist). Deleted the "Credits assigned to you" block and the dead "Team" row in the invite screens |
| 4 | `MemberRow`, `RoleSelectorDropdown`, `TeamRow` | `44edfe6` | Deleted 3 fully-orphaned components (zero renderers anywhere) |
| 5 | `roles.ts` | `7cd9ec7` | Deleted the `Editor` role class — backend has no editor/viewer role at all (`owner\|admin\|member\|service`) |
| 6 | `org-context.tsx` | `7cd9ec7` | Deleted dead `teams`/`activeTeamId`/`refreshTeams`/`removeTeam` state — teams can never exist any more |
| 7 | **`InviteModal`** (Members → Invite) | `7cd9ec7` | **Live bug fix:** deleted the "Editor" role option — it used to appear in the dropdown with a real description, then silently downgrade to "Member" on submit |
| 8 | **`souvenir-slack/page.tsx`** | `7cd9ec7` | **Live bug fix:** the empty-state message always said *"No teams are available yet. Create a team..."* regardless of reality — now says *"No shared projects yet. Share a project..."* |
| 9 | **`projects/new/page.tsx`** | `7cd9ec7` | **Live bug fix:** deleted a dead "Access" team-picker, and an effect that fired a wrong *"Couldn't preselect that team"* toast on certain links |
| 10 | `LeftSidebar.tsx` | `7cd9ec7` | Simplified the sidebar's project sections and role-badge color logic (no behavior change — just removed dead branches feeding the same output) |
| 11 | `chat/page.tsx`, `projects/page.tsx`, `members/page.tsx` | `7cd9ec7` | Simplified dead team-name lookups (always resolved to nothing anyway — no visible change) |

Rows 1–6 and 10–11 are dead-code removal with no intended visible change — worth a quick sanity look but not the focus. Rows 7–9 are the ones that actually changed behavior.

## Test cases

| # | Area | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 1 | Invite modal — role options | Settings → Members → Invite. Open the role dropdown. | Only **Member** and **Admin** show. No "Editor" option anywhere. | | |
| 2 | Invite modal — send invite | Pick Member, type a valid email, add a project (optional), send. | Invite sends normally; new pending row appears with role "Member." | | |
| 3 | Invite modal — project access | With role = Member, open "Project access" dropdown. | Shows a plain list of shared project titles — no team name/avatar next to each one. | | |
| 4 | Souvenir Slack empty state | Go to Settings → Souvenir in Slack, on an org with **no** projects shared with the org yet. | Message reads *"No shared projects yet. Share a project with your organization to add its Slack channel here."* — **not** anything about "create a team." | | |
| 5 | Souvenir Slack with a shared project | Share one project with the org, then revisit the Slack settings page. | That project now appears in the table with a subtitle starting **"Shared / ..."** | | |
| 6 | New project — no team picker | Go to `/projects/new`. | Only "Name" and "Description" fields. No "Access" dropdown, no "Private project / Team: X" picker. | | |
| 7 | New project — via a link with `?teamId=` | Visit `/projects/new?teamId=anything`. | Page loads normally, no toast/error about "Couldn't preselect that team." | | |
| 8 | Members page — role badges | Settings → Members, look at every member's role badge. | Only **Owner** / **Admin** / **Member** badges appear — never "Editor." | | |
| 9 | Members page — manage role | Click "Manage" on a Member row. | Modal offers only Admin/Member toggle — no team section, no editor option. | | |
| 10 | Onboarding invite — accept flow | Use a real invite link end-to-end (welcome → join → profile → confirm). | No page mentions "team" by name; confirm screen shows no "Credits assigned to you" block unless that's a real field (it never was, so it should never show). | | |
| 11 | Left sidebar — org account | Log in as an org member, look at the left sidebar's project section. | Sidebar renders "Workspace projects" section with your org's shared projects — no console errors. | | |
| 12 | Left sidebar — personal account | Log in as a non-org user. | Sidebar shows "Personal Projects" normally. | | |
| 13 | Agents tab | Go to `/agents`. | Normal agents list renders — no "Team Agents" tab exists anymore (should already be gone from earlier work, just confirming nothing broke). | | |
| 14 | Chat "just joined" banner | Right after accepting an invite, land on `/chat`. | Toast/banner says "You've joined **\<org name\>**" — not a team name. | | |
| 15 | Projects list/grid view | Go to `/projects`, view both list and grid layouts. | Project cards show normally; the small scope icon defaults to "Personal" styling (no crash, no broken team label). | | |

If anything doesn't match, note the row number and what you actually saw (screenshot if visual) so it can be dug into.
