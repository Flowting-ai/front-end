import { describe, expect, it } from "vitest";
import { routeToScreen } from "./screens";

describe("routeToScreen", () => {
  it("maps primary surfaces to their screen concepts", () => {
    expect(routeToScreen("/chat")).toBe("chat");
    expect(routeToScreen("/chats")).toBe("chat_history");
    expect(routeToScreen("/brain")).toBe("brain");
    expect(routeToScreen("/agents")).toBe("agent_library");
    expect(routeToScreen("/projects")).toBe("projects");
    expect(routeToScreen("/welcome")).toBe("welcome");
  });

  it("treats /brain sub-views and /agents variants as their parent concept", () => {
    expect(routeToScreen("/brain/schedules")).toBe("brain");
    expect(routeToScreen("/brain/threads")).toBe("brain");
    expect(routeToScreen("/agents/templates")).toBe("agent_library");
    expect(routeToScreen("/agents/published")).toBe("agent_library");
  });

  it("distinguishes the agent configure dashboard from the new-agent wizard", () => {
    expect(routeToScreen("/agent/configure")).toBe("agent_configure");
    expect(routeToScreen("/agent/configure/connectors")).toBe("agent_configure");
    expect(routeToScreen("/agents/basics/name")).toBe("agent_onboarding");
  });

  it("routes chat surfaces nested under agents/projects to chat", () => {
    expect(routeToScreen("/agents/persona-123/chat")).toBe("chat");
    expect(routeToScreen("/project/abc/chat/def")).toBe("chat");
    expect(routeToScreen("/project/abc")).toBe("project_detail");
  });

  it("collapses all /org tabs to org_manage and /teams/[id] to teams", () => {
    expect(routeToScreen("/org")).toBe("org_manage");
    expect(routeToScreen("/org/members")).toBe("org_manage");
    expect(routeToScreen("/org/teams/team-1")).toBe("org_manage");
    expect(routeToScreen("/teams/team-9")).toBe("teams");
  });

  it("maps settings tabs (including the real /account and /ai names)", () => {
    expect(routeToScreen("/settings")).toBe("settings_profile");
    expect(routeToScreen("/settings/account")).toBe("settings_profile");
    expect(routeToScreen("/settings/connectors")).toBe("settings_connectors");
    expect(routeToScreen("/settings/ai")).toBe("settings_models");
    expect(routeToScreen("/settings/billing/change-plan")).toBe("settings_billing");
    expect(routeToScreen("/settings/security")).toBe("settings_security");
  });

  it("derives onboarding step names, normalizing punctuation", () => {
    expect(routeToScreen("/onboarding")).toBe("onboarding_start");
    expect(routeToScreen("/onboarding/hello")).toBe("onboarding_hello");
    expect(routeToScreen("/onboarding/account-type")).toBe("onboarding_account_type");
    expect(routeToScreen("/onboarding/team/invite-1/join")).toBe("onboarding_team_join");
  });

  it("maps share + slack routes", () => {
    expect(routeToScreen("/share/abc")).toBe("share_view");
    expect(routeToScreen("/chat-shares/abc")).toBe("share_view");
    expect(routeToScreen("/slack/link")).toBe("slack_setup");
  });

  it("returns null for the root and unmapped routes", () => {
    expect(routeToScreen("/")).toBeNull();
    expect(routeToScreen("")).toBeNull();
    expect(routeToScreen("/some/unknown/route")).toBeNull();
    expect(routeToScreen("/agent/unknown")).toBeNull();
  });

  it("ignores trailing slashes", () => {
    expect(routeToScreen("/chat/")).toBe("chat");
    expect(routeToScreen("/settings/ai/")).toBe("settings_models");
  });
});
