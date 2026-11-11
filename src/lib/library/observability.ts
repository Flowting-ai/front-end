// One place every Library error boundary and failed handler reports through. Today it is a console
// shim (there is no monitoring SDK in the app yet, open question OQ-30); when Sentry or similar is
// adopted, only `reporter` below changes. Context carries ids and enums only: never a file name,
// title, search text or URL, which are private to the person.

export type ErrorContext = {
  /** Which boundary or handler caught it: "file-preview", "list", "upload", ... */
  boundary?: string;
  route?: string;
  fileId?: string;
  action?: string;
};

type Reporter = (error: unknown, context: ErrorContext) => void;

const consoleReporter: Reporter = (error, context) => {
  const name = error instanceof Error ? error.name : "NonError";
  if (process.env.NODE_ENV === "development") {
    console.error("[library]", name, error instanceof Error ? error.message : "", context);
  } else {
    console.error("[library]", name, context);
  }
};

let reporter: Reporter = consoleReporter;

/** Swap the destination (tests, or a future monitoring SDK). */
export function setErrorReporter(next: Reporter | null): void {
  reporter = next ?? consoleReporter;
}

export function captureError(error: unknown, context: ErrorContext = {}): void {
  try {
    reporter(error, context);
  } catch {
    // Reporting must never throw into the code path that is already handling a failure.
  }
}

/** Coarse buckets so analytics never carries an exact size or duration. */
export function sizeBucket(bytes: number): "xs" | "s" | "m" | "l" | "xl" {
  if (bytes < 100_000) return "xs";
  if (bytes < 1_000_000) return "s";
  if (bytes < 10_000_000) return "m";
  if (bytes < 30_000_000) return "l";
  return "xl";
}

export function durationBucket(ms: number): "lt1s" | "lt5s" | "lt30s" | "gte30s" {
  if (ms < 1000) return "lt1s";
  if (ms < 5000) return "lt5s";
  if (ms < 30_000) return "lt30s";
  return "gte30s";
}
