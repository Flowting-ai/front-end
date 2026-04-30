/**
 * Throttling and debouncing utilities for performance and rate limiting
 */

/**
 * Debounce function - delays execution until after wait time has elapsed since last call
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per specified time period
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
}

/**
 * Async debounce with promise support
 */
export function debounceAsync<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;

  return function executedFunction(...args: Parameters<T>): Promise<ReturnType<T>> {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise<ReturnType<T>>((resolve) => {
        timeout = setTimeout(async () => {
          timeout = null;
          const result = await func(...args);
          pendingPromise = null;
          resolve(result);
        }, wait);
      });
    }

    return pendingPromise;
  };
}

/**
 * Request queue with concurrency limit.
 * Prevents overwhelming the server with too many simultaneous requests.
 */
export class RequestQueue {
  private queue: Array<() => Promise<unknown>> = [];
  private running = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result as T);
        } catch (error) {
          reject(error);
        }
      });
      this.run();
    });
  }

  private async run(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const fn = this.queue.shift();

    if (fn) {
      try {
        await fn();
      } finally {
        this.running--;
        this.run();
      }
    }
  }
}

/**
 * Exponential backoff for retry logic
 */
export async function exponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker — prevents cascading failures.
 *
 * States: CLOSED (normal) → OPEN (rejecting) → HALF_OPEN (probing) → CLOSED
 *
 * - OPEN: rejects immediately without hitting the network
 * - HALF_OPEN probe succeeds: transitions to CLOSED, clears failure count
 * - HALF_OPEN probe fails: returns to OPEN, resets the timeout window
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold = 5, timeout = 30000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  get isOpen(): boolean {
    return this.state === "open";
  }

  /** Milliseconds remaining before the circuit transitions to HALF_OPEN. */
  get retryInMs(): number {
    if (this.state !== "open") return 0;
    const elapsed = Date.now() - this.lastFailTime;
    return Math.max(0, this.timeout - elapsed);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = "half-open";
      } else {
        throw new Error("Service temporarily unavailable");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = "closed";
  }
}

/**
 * Batch requests together to reduce API calls.
 * Note: In the current implementation individual item resolution requires
 * each caller to await the same flush. A future revision can track per-item
 * resolve/reject pairs for true fan-out semantics.
 */
export class RequestBatcher<T, R> {
  private batch: T[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly delay: number;
  private readonly executor: (items: T[]) => Promise<R[]>;

  constructor(executor: (items: T[]) => Promise<R[]>, batchSize = 10, delay = 100) {
    this.executor = executor;
    this.batchSize = batchSize;
    this.delay = delay;
  }

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push(item);

      if (this.batch.length >= this.batchSize) {
        this.flush().catch(reject);
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => {
          this.flush().catch(reject);
        }, this.delay);
      }

      this.flush().then((results) => resolve(results[0] as R)).catch(reject);
    });
  }

  private async flush(): Promise<R[]> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.batch.length === 0) {
      return [];
    }

    const items = [...this.batch];
    this.batch = [];

    return this.executor(items);
  }
}
