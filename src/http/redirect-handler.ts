import type { HTTPClient } from './http-client.js';

export interface RedirectOptions {
  maxRedirects?: number;
  validateCertificate?: boolean;
}

export class RedirectHandler {
  private httpClient: HTTPClient;
  private maxRedirects: number;

  constructor(httpClient: HTTPClient, options: RedirectOptions = {}) {
    this.httpClient = httpClient;
    this.maxRedirects = options.maxRedirects ?? 1; // PEPPOL spec: max 1 redirect
  }

  /**
   * Follows HTTP redirects according to PEPPOL spec
   * Note: Spec prefers SMP-level redirects over HTTP redirects
   */
  async followRedirects(url: string): Promise<{
    finalUrl: string;
    statusCode: number;
    body: string;
    redirectCount: number;
  }> {
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount <= this.maxRedirects) {
      const response = await this.httpClient.get(currentUrl);

      // Check if it's a redirect
      if (response.statusCode >= 300 && response.statusCode < 400) {
        const location = this.getLocationHeader(response.headers);

        if (!location) {
          throw new Error(`Redirect response missing Location header: ${currentUrl}`);
        }

        // Resolve relative URLs
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;

        if (redirectCount > this.maxRedirects) {
          throw new Error(`Maximum redirects (${this.maxRedirects}) exceeded`);
        }

        continue;
      }

      // Not a redirect, return the response
      return {
        finalUrl: currentUrl,
        statusCode: response.statusCode,
        body: response.body,
        redirectCount
      };
    }

    throw new Error(`Redirect loop detected after ${redirectCount} redirects`);
  }

  /**
   * Extracts Location header value
   */
  private getLocationHeader(headers: Record<string, string | string[]>): string | null {
    const location = headers['location'] || headers['Location'];

    if (Array.isArray(location)) {
      return location[0] || null;
    }

    return location || null;
  }

  /**
   * Validates if a redirect is allowed according to PEPPOL spec
   */
  validateRedirect(fromUrl: string, toUrl: string): boolean {
    try {
      const from = new URL(fromUrl);
      const to = new URL(toUrl);

      // Must be HTTPS
      if (to.protocol !== 'https:') {
        return false;
      }

      // No credentials allowed
      if (to.username || to.password) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
