import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { libraryErrorMessage } from "./errors";
import { MESSAGES } from "./messages";

describe("libraryErrorMessage", () => {
  it("reads a 403 forbidden as only-the-owner", () => {
    expect(libraryErrorMessage(new ApiError(403, "forbidden", "Forbidden"), "fallback")).toBe(MESSAGES.onlyOwner);
  });

  it("keeps the fallback for unknown codes and non-API errors", () => {
    expect(libraryErrorMessage(new ApiError(409, "preview_processing", "x"), "fallback")).toBe("fallback");
    expect(libraryErrorMessage(new Error("x"), "fallback")).toBe("fallback");
  });
});
