export interface FetchOptions {
  userAgent: string;
  /** Minimum gap between requests to the same host. */
  delayMs: number;
  timeoutMs?: number;
  maxRetries?: number;
  maxBytes?: number;
}

export interface FetchOutcome {
  url: string;
  finalUrl: string;
  status: number;
  redirectChain: string[];
  contentType: string;
  body: string;
  bytes: number;
  elapsedMs: number;
  error?: string;
}

const DEFAULT_TIMEOUT = 20_000;
const DEFAULT_RETRIES = 2;
/** 5 MB. Enough for any HTML page; guards against a stray media file. */
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Serialises requests per host so a concurrent crawl still honours the
 * politeness delay. Each host gets a promise chain; callers await their slot.
 */
export class PoliteFetcher {
  private readonly opts: Required<FetchOptions>;
  private queues = new Map<string, Promise<void>>();

  constructor(opts: FetchOptions) {
    this.opts = {
      timeoutMs: DEFAULT_TIMEOUT,
      maxRetries: DEFAULT_RETRIES,
      maxBytes: DEFAULT_MAX_BYTES,
      ...opts,
    };
  }

  /** Reserve the next slot for `host` and resolve when it is our turn. */
  private slot(host: string): Promise<void> {
    const prev = this.queues.get(host) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    // The queue advances only after the caller's wait finishes.
    this.queues.set(
      host,
      prev.then(() => mine),
    );
    return prev.then(() => {
      // Hold the lane for delayMs, then let the next caller through.
      setTimeout(release, this.opts.delayMs);
    });
  }

  async get(url: string): Promise<FetchOutcome> {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return errorOutcome(url, `invalid URL`);
    }

    await this.slot(host);

    const started = Date.now();
    let lastError = "unknown error";

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      if (attempt > 0) {
        // 1s, 2s, 4s. Enough to clear a transient 429/503.
        await sleep(1000 * 2 ** (attempt - 1));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);

      try {
        const res = await fetch(url, {
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "user-agent": this.opts.userAgent,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
          },
        });

        const contentType = res.headers.get("content-type") ?? "";

        // Retry only on transient server-side conditions.
        if ((res.status === 429 || res.status >= 500) && attempt < this.opts.maxRetries) {
          lastError = `HTTP ${res.status}`;
          clearTimeout(timer);
          continue;
        }

        const body = await readCapped(res, this.opts.maxBytes);
        clearTimeout(timer);

        return {
          url,
          finalUrl: res.url || url,
          status: res.status,
          // fetch() does not expose the intermediate hops; record the net effect.
          redirectChain: res.url && res.url !== url ? [url, res.url] : [],
          contentType,
          body,
          bytes: Buffer.byteLength(body, "utf8"),
          elapsedMs: Date.now() - started,
        };
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt >= this.opts.maxRetries) break;
      }
    }

    return { ...errorOutcome(url, lastError), elapsedMs: Date.now() - started };
  }
}

/** Read the response body but stop once maxBytes is exceeded. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return await res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      chunks.push(value);
      if (total >= maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

function errorOutcome(url: string, error: string): FetchOutcome {
  return {
    url,
    finalUrl: url,
    status: 0,
    redirectChain: [],
    contentType: "",
    body: "",
    bytes: 0,
    elapsedMs: 0,
    error,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
