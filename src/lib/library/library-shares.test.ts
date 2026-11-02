import { describe, expect, it } from "vitest"
import { parseLibraryShare } from "./library-shares"

const SHARE = { fileId: "f1", grantId: "g1", label: "Weekly sales report", personName: "Maya" }

describe("library shares", () => {
  it("reads the library_shared event", () => {
    expect(parseLibraryShare({ ...SHARE, messageId: "m1" })).toEqual(SHARE)
    expect(parseLibraryShare({ fileId: "f1" })).toBeNull()
  })
})
