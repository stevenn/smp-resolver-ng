// Import the JSON directly as a module
import codeListData from './peppol-codelists-v9.2.json' with { type: 'json' };

interface DocumentTypeEntry {
  name: string;
  scheme: string;
  value: string;
  state: string;
  [key: string]: any;
}

interface CodeList {
  version: string;
  'entry-count': number;
  values: DocumentTypeEntry[];
}

/**
 * Document type lookup based on official PEPPOL code lists
 */
export class DocumentTypeLookup {
  private static instance: DocumentTypeLookup;
  private codeList: CodeList;
  private lookupMap: Map<string, string>;

  private constructor() {
    this.codeList = codeListData as CodeList;
    
    // Build lookup map for fast access
    this.lookupMap = new Map();
    for (const entry of this.codeList.values) {
      if (entry.state === 'active' || entry.state === 'deprecated') {
        // Use the full value as the key
        this.lookupMap.set(entry.value, entry.name);
      }
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DocumentTypeLookup {
    if (!DocumentTypeLookup.instance) {
      DocumentTypeLookup.instance = new DocumentTypeLookup();
    }
    return DocumentTypeLookup.instance;
  }

  /**
   * Look up the friendly name for a document type
   */
  getFriendlyName(documentTypeId: string): string | undefined {
    return this.lookupMap.get(documentTypeId);
  }

  /**
   * Get the code list version
   */
  getVersion(): string {
    return this.codeList.version;
  }
}