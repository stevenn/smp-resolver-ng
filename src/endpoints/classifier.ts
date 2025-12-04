/**
 * Parsed endpoint information with proper classification
 */
export interface ParsedEndpointInfo {
  as4Endpoints: string[];
  technicalContactUrl?: string;
  technicalInformationUrl?: string;
}

/**
 * Extended endpoint result with parsed technical information
 */
export interface ExtendedEndpointResult {
  participantId: string;
  success: boolean;
  endpointUrls: string[];
  smpHostname?: string;
  error?: string;
  technicalInfo: ParsedEndpointInfo;
}

/**
 * Endpoint URL classifier
 * Separates AS4 transport endpoints from technical contact/information URLs
 */
export class EndpointClassifier {

  /**
   * Classify endpoint URLs to separate AS4 endpoints from technical URLs
   * @param endpointUrls Array of endpoint URLs
   * @returns Classified endpoint information
   */
  static classifyEndpoints(endpointUrls: string[]): ParsedEndpointInfo {
    const as4Endpoints: string[] = [];
    let technicalContactUrl: string | undefined;
    let technicalInformationUrl: string | undefined;

    for (const url of endpointUrls) {
      if (this.isAs4Endpoint(url)) {
        as4Endpoints.push(url);
      } else if (this.isEmailContact(url)) {
        technicalContactUrl = url;
      } else if (this.isInformationUrl(url)) {
        technicalInformationUrl = url;
      }
    }

    return {
      as4Endpoints,
      technicalContactUrl,
      technicalInformationUrl
    };
  }

  /**
   * Check if URL is an AS4 transport endpoint
   * @param url URL to check
   * @returns Whether URL is AS4 endpoint
   */
  static isAs4Endpoint(url: string): boolean {
    return url.includes('/as4') || url.includes('/peppol/as4');
  }

  /**
   * Check if URL is a technical contact (email)
   * @param url URL to check
   * @returns Whether URL is email contact
   */
  static isEmailContact(url: string): boolean {
    return url.startsWith('mailto:') || url.includes('@');
  }

  /**
   * Check if URL is a technical information URL
   * @param url URL to check
   * @returns Whether URL is information URL
   */
  static isInformationUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Extract primary AS4 endpoint from parsed info
   * @param technicalInfo Parsed endpoint information
   * @returns Primary AS4 endpoint URL or empty string
   */
  static getPrimaryAs4Endpoint(technicalInfo: ParsedEndpointInfo): string {
    return technicalInfo.as4Endpoints.length > 0 ? technicalInfo.as4Endpoints[0] : '';
  }

  /**
   * Get all unique AS4 endpoints from multiple results
   * @param results Array of extended endpoint results
   * @returns Array of unique AS4 endpoint URLs
   */
  static getAllAs4Endpoints(results: ExtendedEndpointResult[]): string[] {
    const allEndpoints = results.flatMap(result => result.technicalInfo.as4Endpoints);
    return [...new Set(allEndpoints)];
  }

  /**
   * Get statistics about endpoint types
   * @param results Array of extended endpoint results
   * @returns Endpoint statistics
   */
  static getEndpointStats(results: ExtendedEndpointResult[]): {
    totalResults: number;
    successfulResults: number;
    totalAs4Endpoints: number;
    resultsWithTechnicalContact: number;
    resultsWithTechnicalInfo: number;
    uniqueAs4Endpoints: number;
  } {
    const successful = results.filter(r => r.success);
    const withContact = results.filter(r => r.technicalInfo.technicalContactUrl);
    const withInfo = results.filter(r => r.technicalInfo.technicalInformationUrl);
    const allAs4 = this.getAllAs4Endpoints(results);

    return {
      totalResults: results.length,
      successfulResults: successful.length,
      totalAs4Endpoints: results.reduce((sum, r) => sum + r.technicalInfo.as4Endpoints.length, 0),
      resultsWithTechnicalContact: withContact.length,
      resultsWithTechnicalInfo: withInfo.length,
      uniqueAs4Endpoints: allAs4.length
    };
  }
}
