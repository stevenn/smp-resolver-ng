import { Agent, request, Pool } from 'undici';

// Fallback User-Agent version — derived from package.json (single source of truth)
import pkg from '../../package.json' with { type: 'json' };

export interface HTTPClientOptions {
  timeout?: number;
  userAgent?: string;
  maxConnections?: number;
  pipelining?: number;
}

export class HTTPClient {
  private agent: Agent;
  private pools: Map<string, Pool>;
  private timeout: number;
  private userAgent: string;

  constructor(options: HTTPClientOptions = {}) {
    this.timeout = options.timeout ?? 30000;
    this.userAgent = options.userAgent ?? `smp-resolver-ng/${pkg.version}`;
    this.pools = new Map();

    this.agent = new Agent({
      connections: options.maxConnections ?? 100,
      pipelining: options.pipelining ?? 10,
      connect: {
        timeout: this.timeout,
        keepAlive: true
      }
    });
  }

  /**
   * Get or create a connection pool for a specific origin
   */
  private getPool(origin: string): Pool {
    let pool = this.pools.get(origin);
    if (!pool) {
      pool = new Pool(origin, {
        connections: 10,
        pipelining: 10,
        connect: {
          timeout: this.timeout,
          keepAlive: true
        }
      });
      this.pools.set(origin, pool);
    }
    return pool;
  }

  /**
   * Connection-level errors that a retry on a fresh connection can recover from.
   * These happen when a server closes a pooled/keep-alive socket mid-flight, and
   * say nothing about whether the resource exists.
   */
  static isTransientConnectionError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('other side closed') ||
      message.includes('ECONNRESET') ||
      message.includes('socket hang up')
    );
  }

  /**
   * True when a request gave up waiting rather than being refused or dropped.
   * A timeout suggests the origin is unresponsive, so callers probing several
   * URLs are right to stop; other failures say nothing about the next URL.
   */
  static isTimeoutError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code ?? '';
    if (code.startsWith('UND_ERR_') && code.includes('TIMEOUT')) {
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('timeout');
  }

  /**
   * Performs HTTP GET request with connection pooling and retry on connection errors
   */
  async get(
    url: string,
    additionalHeaders: Record<string, string> = {}
  ): Promise<{
    statusCode: number;
    headers: Record<string, string | string[]>;
    body: string;
  }> {
    const parsed = new URL(url);
    const pool = this.getPool(parsed.origin);

    // Try with pooled connection first
    try {
      const response = await request(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/xml, text/xml',
          ...additionalHeaders
        },
        dispatcher: pool,
        bodyTimeout: this.timeout,
        headersTimeout: this.timeout
      });

      const statusCode = response.statusCode;
      const headers = response.headers as Record<string, string | string[]>;

      // Read body as text
      const body = await response.body.text();

      return {
        statusCode,
        headers,
        body
      };
    } catch (error) {
      // Retry with fresh connection on "other side closed" or similar connection errors
      // These happen when servers don't properly support HTTP pipelining
      if (HTTPClient.isTransientConnectionError(error)) {
        // Create a fresh connection without pipelining
        const freshPool = new Pool(parsed.origin, {
          connections: 1,
          pipelining: 1,
          connect: {
            timeout: this.timeout,
            keepAlive: false
          }
        });

        try {
          const response = await request(url, {
            method: 'GET',
            headers: {
              'User-Agent': this.userAgent,
              Accept: 'application/xml, text/xml',
              ...additionalHeaders
            },
            dispatcher: freshPool,
            bodyTimeout: this.timeout,
            headersTimeout: this.timeout
          });

          const statusCode = response.statusCode;
          const headers = response.headers as Record<string, string | string[]>;
          const body = await response.body.text();

          return { statusCode, headers, body };
        } finally {
          await freshPool.close();
        }
      }
      throw error;
    }
  }

  /**
   * Performs HTTP GET request with a custom timeout (for optional fetches like business cards)
   */
  async getWithTimeout(
    url: string,
    timeoutMs: number,
    additionalHeaders: Record<string, string> = {}
  ): Promise<{
    statusCode: number;
    headers: Record<string, string | string[]>;
    body: string;
  }> {
    const parsed = new URL(url);

    const fetchOnce = async (connections: number) => {
      // Create a temporary pool with the custom timeout
      const tempPool = new Pool(parsed.origin, {
        connections,
        pipelining: 1,
        connect: {
          timeout: timeoutMs,
          keepAlive: false
        }
      });

      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/xml, text/xml',
            ...additionalHeaders
          },
          dispatcher: tempPool,
          bodyTimeout: timeoutMs,
          headersTimeout: timeoutMs
        });

        const statusCode = response.statusCode;
        const headers = response.headers as Record<string, string | string[]>;
        const body = await response.body.text();

        return { statusCode, headers, body };
      } finally {
        await tempPool.close();
      }
    };

    try {
      return await fetchOnce(2);
    } catch (error) {
      // A dropped socket says nothing about whether the resource exists, so retry
      // once on a fresh single connection before reporting failure. Without this,
      // optional fetches (business cards) silently vanish on a transient blip.
      if (HTTPClient.isTransientConnectionError(error)) {
        return await fetchOnce(1);
      }
      throw error;
    }
  }

  /**
   * Performs HTTP HEAD request to check URL existence
   */
  async head(url: string): Promise<{
    statusCode: number;
    headers: Record<string, string | string[]>;
  }> {
    const parsed = new URL(url);
    const pool = this.getPool(parsed.origin);

    const response = await request(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': this.userAgent
      },
      dispatcher: pool,
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout
    });

    return {
      statusCode: response.statusCode,
      headers: response.headers as Record<string, string | string[]>
    };
  }

  /**
   * Closes all connection pools
   */
  async close(): Promise<void> {
    await this.agent.close();
    for (const pool of this.pools.values()) {
      await pool.close();
    }
    this.pools.clear();
  }

  /**
   * Gets statistics about connection pools
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};
    for (const [origin, pool] of this.pools.entries()) {
      stats[origin] = pool.stats;
    }
    return stats;
  }
}
