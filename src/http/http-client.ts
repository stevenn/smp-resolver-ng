import { Agent, request, Pool } from 'undici';

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
    this.userAgent = options.userAgent ?? 'smp-resolver-ng/2.2.1';
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
   * Performs HTTP GET request with connection pooling
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
