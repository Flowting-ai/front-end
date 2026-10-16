// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { LIBRARY_FILES_CHANGED_EVENT, notifyLibraryFilesChanged } from "./files-changed"

describe("notifyLibraryFilesChanged", () => {
  const listeners: Array<() => void> = []
  afterEach(() => {
    for (const listener of listeners.splice(0)) window.removeEventListener(LIBRARY_FILES_CHANGED_EVENT, listener)
  })

  it("tells every listener once per call", () => {
    const listener = vi.fn()
    listeners.push(listener)
    window.addEventListener(LIBRARY_FILES_CHANGED_EVENT, listener)
    notifyLibraryFilesChanged()
    notifyLibraryFilesChanged()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("does nothing once a listener is removed", () => {
    const listener = vi.fn()
    window.addEventListener(LIBRARY_FILES_CHANGED_EVENT, listener)
    window.removeEventListener(LIBRARY_FILES_CHANGED_EVENT, listener)
    notifyLibraryFilesChanged()
    expect(listener).not.toHaveBeenCalled()
  })
})
