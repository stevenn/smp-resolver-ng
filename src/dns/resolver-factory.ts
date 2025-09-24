import { NAPTRResolver } from './naptr-resolver.js';
import { DoHResolver } from './doh-resolver.js';
import type { IDNSResolver } from './dns-resolver.interface.js';

export interface ResolverFactoryOptions {
  useDoH?: boolean;
  dnsServers?: string[];
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * Factory for creating DNS resolvers
 * Returns either standard DNS resolver or DoH resolver based on configuration
 */
export function createDNSResolver(options: ResolverFactoryOptions = {}): IDNSResolver {
  if (options.useDoH) {
    // Create DoH resolver using Tangerine
    return new DoHResolver({
      timeout: options.timeout,
      cache: options.cache,
      cacheTTL: options.cacheTTL
    });
  } else {
    // Create standard DNS resolver
    return new NAPTRResolver({
      dnsServers: options.dnsServers,
      timeout: options.timeout
    });
  }
}