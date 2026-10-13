import { describe, expect, it } from "vitest";
import { blockingCount, canSend, newUploadItem, reduceUpload, statusLabel, type UploadEvent, type UploadItem } from "./machine";

function item(overrides: Partial<UploadItem> = {}): UploadItem {
  return { ...newUploadItem({ id: "u1", draftKey: "new", name: "a.pdf", sizeBytes: 1000, mimeType: "application/pdf", format: "pdf", startedAt: 0 }), ...overrides };
}

function run(start: UploadItem, ...events: UploadEvent[]): UploadItem {
  return events.reduce(reduceUpload, start);
}

describe("reduceUpload: the happy path", () => {
  it("goes validating, uploading, processing, ready", () => {
    const done = run(item(), { type: "validated" }, { type: "created", serverId: "s1" }, { type: "progress", value: 0.5 }, { type: "uploaded" }, { type: "server", phase: "ready", slow: false, fileId: "f1" });
    expect(done).toMatchObject({ status: "ready", progress: 1, serverId: "s1", fileId: "f1" });
  });

  it("only moves progress forward and never past 1", () => {
    const base = run(item(), { type: "validated" });
    expect(run(base, { type: "progress", value: 0.6 }, { type: "progress", value: 0.4 }).progress).toBe(0.6);
    expect(run(base, { type: "progress", value: 7 }).progress).toBe(1);
  });

  it("ignores progress outside the uploading state", () => {
    expect(run(item(), { type: "progress", value: 0.5 }).progress).toBe(0);
  });
});

describe("reduceUpload: pausing", () => {
  it("pauses only while uploading and resumes back to uploading", () => {
    const uploading = run(item(), { type: "validated" });
    const paused = reduceUpload(uploading, { type: "paused" });
    expect(paused.status).toBe("paused");
    expect(reduceUpload(paused, { type: "resumed" }).status).toBe("uploading");
    expect(reduceUpload(item(), { type: "paused" }).status).toBe("validating");
  });
});

describe("reduceUpload: processing and failure", () => {
  const processing = run(item(), { type: "validated" }, { type: "uploaded" });

  it("tracks the slow flag while processing", () => {
    expect(reduceUpload(processing, { type: "server", phase: "processing", slow: true }).slow).toBe(true);
  });

  it("fails with the server's reason, defaulting to unreadable", () => {
    expect(reduceUpload(processing, { type: "server", phase: "failed", slow: false, failure: "password_protected" })).toMatchObject({ status: "failed", failure: "password_protected" });
    expect(reduceUpload(processing, { type: "server", phase: "failed", slow: false }).failure).toBe("unreadable");
  });

  it("does not let a late event move a finished upload", () => {
    const ready = reduceUpload(processing, { type: "server", phase: "ready", slow: false, fileId: "f1" });
    expect(reduceUpload(ready, { type: "fail", reason: "network" })).toBe(ready);
    expect(reduceUpload(ready, { type: "cancel" })).toBe(ready);
    const cancelled = reduceUpload(item(), { type: "cancel" });
    expect(reduceUpload(cancelled, { type: "validated" })).toBe(cancelled);
  });

  it("keeps a failure until a retry, which starts over", () => {
    const failed = reduceUpload(processing, { type: "fail", reason: "network" });
    expect(reduceUpload(failed, { type: "progress", value: 0.9 })).toBe(failed);
    const retried = reduceUpload(failed, { type: "retry" });
    expect(retried).toMatchObject({ status: "validating", progress: 0, failure: undefined, serverId: undefined });
  });

  it("can be cancelled from any in-flight state", () => {
    for (const events of [[], [{ type: "validated" }], [{ type: "validated" }, { type: "uploaded" }]] as UploadEvent[][]) {
      expect(run(item(), ...events, { type: "cancel" }).status).toBe("cancelled");
    }
  });
});

describe("sending", () => {
  it("holds Send until every attachment is ready; failed and cancelled ones do not block", () => {
    const ready = item({ id: "a", status: "ready" });
    const uploading = item({ id: "b", status: "uploading" });
    const failed = item({ id: "c", status: "failed", failure: "unsupported" });
    expect(canSend([])).toBe(true);
    expect(canSend([ready])).toBe(true);
    expect(canSend([ready, uploading])).toBe(false);
    expect(canSend([ready, failed])).toBe(true);
    expect(canSend([item({ status: "paused" })])).toBe(false);
    expect(blockingCount([ready, uploading, failed, item({ id: "d", status: "processing" })])).toBe(2);
  });

  it("labels each status in words", () => {
    expect(statusLabel(item({ status: "uploading", progress: 0.426 }))).toBe("Uploading 43%");
    expect(statusLabel(item({ status: "processing", slow: true }))).toBe("Taking longer than usual");
    expect(statusLabel(item({ status: "paused" }))).toBe("Paused");
    expect(statusLabel(item({ status: "ready" }))).toBe("Ready");
  });
});
