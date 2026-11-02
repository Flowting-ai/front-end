import { describe, expect, it } from "vitest";
import { ADMIN_SECTION_COMING_SOON, ADMIN_SECTION_ROUTES, ORG_ADMIN_GROUPS } from "./admin-nav";
import {
  ORG_ACTIVITY_ROUTE,
  ORG_ANALYTICS_ROUTE,
  ORG_CONNECTORS_ROUTE,
  ORG_GENERAL_ROUTE,
  ORG_MEMBERS_ROUTE,
  ORG_PLANS_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
} from "@/lib/routes";

describe("admin nav", () => {
  it("maps each admin item id to its route constant", () => {
    expect(ADMIN_SECTION_ROUTES).toEqual({
      general: ORG_GENERAL_ROUTE,
      members: ORG_MEMBERS_ROUTE,
      "plans-usage": ORG_PLANS_ROUTE,
      analytics: ORG_ANALYTICS_ROUTE,
      connectors: ORG_CONNECTORS_ROUTE,
      "souvenir-slack": ORG_SOUVENIR_SLACK_ROUTE,
      "activity-log": ORG_ACTIVITY_ROUTE,
    });
    for (const href of Object.values(ADMIN_SECTION_ROUTES)) expect(href).toMatch(/^\//);
  });

  it("has no coming-soon items", () => {
    expect(ADMIN_SECTION_COMING_SOON).toEqual({});
  });

  it("drops the Company Data group and the Teams item", () => {
    expect(ORG_ADMIN_GROUPS.some((g) => g.id === "company-data")).toBe(false);
    const org = ORG_ADMIN_GROUPS.find((g) => g.id === "organization");
    expect(org).toBeDefined();
    expect(org!.items.some((i) => i.id === "teams")).toBe(false);
  });

  // Items in neither map fall through to a "<id> — coming soon" toast. Pinned
  // so a new default admin item can't silently become a dead-ish click.
  it("only leaves the known unrouted items to the coming-soon fallback", () => {
    const unrouted = ORG_ADMIN_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => !(i.id in ADMIN_SECTION_ROUTES) && !(i.id in ADMIN_SECTION_COMING_SOON))
        .map((i) => `${g.id}/${i.id}`),
    );
    expect(unrouted).toEqual(["organization/security"]);
  });
});
