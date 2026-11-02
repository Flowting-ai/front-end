import { describe, expect, it } from "vitest";
import { activeProjectIdFromPathname, includeAllProjects, isOrgSharedProject, sortChatsByRecency, sortProjectsByRecency } from "./project-helpers";
import { orgDisplayName } from "./sidebar-helpers";
import type { Project, ProjectChat } from "@/context/projects-context";

describe("project helpers", () => {
  it("reads the project id from a project route", () => {
    expect(activeProjectIdFromPathname("/project/abc")).toBe("abc");
    expect(activeProjectIdFromPathname("/project/abc/chat/1")).toBe("abc");
    expect(activeProjectIdFromPathname("/projects")).toBeNull();
    expect(activeProjectIdFromPathname("/projects/new")).toBeNull();
    expect(activeProjectIdFromPathname("/chat")).toBeNull();
  });

  it("sorts newest first without mutating the input", () => {
    const chats = [
      { id: "a", updatedAt: "2026-01-01T00:00:00Z" },
      { id: "b", updatedAt: "2026-03-01T00:00:00Z" },
      { id: "c", updatedAt: "2026-02-01T00:00:00Z" },
    ] as ProjectChat[];
    expect(sortChatsByRecency(chats).map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(chats.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(sortProjectsByRecency(chats as unknown as Project[]).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("treats workspace and shared projects as org-shared", () => {
    expect(isOrgSharedProject({ visibility: "workspace" } as Project)).toBe(true);
    expect(isOrgSharedProject({ visibility: "shared" } as Project)).toBe(true);
    expect(isOrgSharedProject({ visibility: "private" } as unknown as Project)).toBe(false);
    expect(includeAllProjects()).toBe(true);
  });
});

describe("orgDisplayName", () => {
  it("strips the auto-generated possessive suffix", () => {
    expect(orgDisplayName("Maya's Organisation")).toBe("Maya");
    expect(orgDisplayName("Maya’s workspace")).toBe("Maya");
    expect(orgDisplayName("Acme's Organization ")).toBe("Acme");
  });

  it("leaves custom names and empty values alone", () => {
    expect(orgDisplayName("Acme Corp")).toBe("Acme Corp");
    expect(orgDisplayName("")).toBe("");
    expect(orgDisplayName(null)).toBeUndefined();
    expect(orgDisplayName(undefined)).toBeUndefined();
  });
});
