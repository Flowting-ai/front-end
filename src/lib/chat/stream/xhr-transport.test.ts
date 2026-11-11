// @vitest-environment jsdom
//
// A request that fails before its upload finished reaches DONE, then fires the
// upload's `loadend` and the request's `error`. It must settle once: no second
// failure log, and no late "upload finished" that marks the stream as started
// again (which left the chat busy — Stop showing, no Retry, the queue held).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { logger } from "@/lib/logger"
import { FriendlyStreamError } from "./stream-errors"
import { sendStreamRequest, type XhrStreamRequest } from "./xhr-transport"

class FakeXHR {
  static HEADERS_RECEIVED = 2
  static DONE = 4
  static last: FakeXHR | null = null
  readyState = 0
  status = 0
  responseText = ""
  withCredentials = false
  uploadListeners: Record<string, Array<() => void>> = {}
  upload = {
    addEventListener: (type: string, fn: () => void) => {
      ;(this.uploadListeners[type] ??= []).push(fn)
    },
  }
  onprogress: (() => void) | null = null
  onreadystatechange: (() => void) | null = null
  onabort: (() => void) | null = null
  onerror: (() => void) | null = null
  open() {}
  setRequestHeader() {}
  getResponseHeader() { return null }
  abort() {}
  send() { FakeXHR.last = this }

  /** The browser's request-error steps: DONE, then the upload's events, then `error`. */
  failNetwork() {
    this.readyState = FakeXHR.DONE
    this.onreadystatechange?.()
    for (const fn of this.uploadListeners.loadend ?? []) fn()
    this.onerror?.()
  }
}

function request(overrides: Partial<XhrStreamRequest> = {}): XhrStreamRequest {
  return {
    target: { isExistingChat: true, useDirectBackend: false, resolvedEndpoint: "/api/chat", resume: undefined },
    directToken: null,
    fd: new FormData(),
    chatId: "chat-1",
    hasFiles: false,
    setXhr: () => {},
    onUploadEnd: vi.fn(),
    onProgress: vi.fn(),
    onText: () => {},
    onHeaderChatId: () => {},
    isStopRequested: () => false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXHR)
  vi.stubGlobal("crypto", { randomUUID: () => "uuid" })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("sendStreamRequest network failure", () => {
  it("settles once: one log, and no late upload-finished after the rejection", async () => {
    const errorLog = vi.spyOn(logger, "error").mockImplementation(() => {})
    const req = request()
    const sent = sendStreamRequest(req)
    FakeXHR.last!.failNetwork()

    await expect(sent).rejects.toBeInstanceOf(FriendlyStreamError)
    expect(req.onUploadEnd).not.toHaveBeenCalled()
    expect(errorLog).toHaveBeenCalledTimes(1)
  })
})
