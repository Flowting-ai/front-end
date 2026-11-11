import { beforeEach, describe, expect, it, vi } from "vitest";
const fetchJson = vi.hoisted(() => vi.fn());
vi.mock("@/lib/config", () => ({ API_BASE_URL: "https://api.example.test" }));
vi.mock("@/lib/api/organization", () => ({ listMembers: vi.fn() }));
vi.mock("@/lib/api/client", async () => ({
  ...await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client"),
  apiFetchJson: fetchJson,
}));
import { libraryApi } from "../api";
beforeEach(() => fetchJson.mockReset());
const input = { name: "file.pdf", sizeBytes: 4, mimeType: "application/pdf" };
describe("backend upload endpoints", () => {
  it("resolves API paths against the deployed backend, bypassing the Next proxy", async () => {
    fetchJson.mockResolvedValue({ id: "upload-id", partSize: 4, parts: [{ partNumber: 1, url: "/library/uploads/upload-id/parts/1" }] });
    const result = await libraryApi.createUpload(input);
    expect(fetchJson).toHaveBeenCalledWith("https://api.example.test/library/uploads", expect.objectContaining({ method: "POST" }));
    expect(result.parts[0].url).toBe("https://api.example.test/library/uploads/upload-id/parts/1");
  });
  it.each(["https://bucket.s3.amazonaws.com/private", "/library/uploads/someone-else/parts/1"])("rejects an unexpected endpoint: %s", async (url) => {
    fetchJson.mockResolvedValue({ id: "upload-id", partSize: 4, parts: [{ partNumber: 1, url }] });
    await expect(libraryApi.createUpload(input)).rejects.toMatchObject({ code: "contract_error" });
  });
});
