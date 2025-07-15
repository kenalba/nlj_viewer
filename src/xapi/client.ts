/**
 * Standalone xAPI Client for LRS Communication
 * 
 * Provides HTTP client for sending xAPI statements to Learning Record Store (LRS)
 * Can be used independently in other projects
 */

import type { XAPIStatement } from './types';

// ============================================================================
// Client Configuration
// ============================================================================

export interface XAPIClientConfig {
  endpoint: string;
  username: string;
  password: string;
  version?: string;
  timeout?: number;
  retryAttempts?: number;
  batchSize?: number;
}

export interface XAPIClientResponse {
  success: boolean;
  statusCode?: number;
  data?: unknown;
  error?: string;
  statementId?: string;
}

// ============================================================================
// xAPI Client Implementation
// ============================================================================

export class XAPIClient {
  private config: XAPIClientConfig;
  private pendingStatements: XAPIStatement[] = [];
  private batchTimeout: number | null = null;

  constructor(config: XAPIClientConfig) {
    this.config = {
      version: '1.0.3',
      timeout: 30000,
      retryAttempts: 3,
      batchSize: 10,
      ...config
    };
  }

  /**
   * Send a single xAPI statement
   */
  async sendStatement(statement: XAPIStatement): Promise<XAPIClientResponse> {
    try {
      const response = await this.makeRequest('/statements', 'POST', statement);
      return {
        success: response.ok,
        statusCode: response.status,
        data: response.ok ? await response.json() : undefined,
        error: response.ok ? undefined : await response.text(),
        statementId: statement.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statementId: statement.id
      };
    }
  }

  /**
   * Send multiple xAPI statements
   */
  async sendStatements(statements: XAPIStatement[]): Promise<XAPIClientResponse> {
    try {
      const response = await this.makeRequest('/statements', 'POST', statements);
      return {
        success: response.ok,
        statusCode: response.status,
        data: response.ok ? await response.json() : undefined,
        error: response.ok ? undefined : await response.text()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add statement to batch queue
   */
  queueStatement(statement: XAPIStatement): void {
    this.pendingStatements.push(statement);
    
    if (this.pendingStatements.length >= this.config.batchSize!) {
      this.flushBatch();
    } else {
      this.scheduleBatchFlush();
    }
  }

  /**
   * Force flush of pending statements
   */
  async flushBatch(): Promise<XAPIClientResponse[]> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.pendingStatements.length === 0) {
      return [];
    }

    const statements = [...this.pendingStatements];
    this.pendingStatements = [];

    const chunks = this.chunkArray(statements, this.config.batchSize!);
    const results: XAPIClientResponse[] = [];

    for (const chunk of chunks) {
      const result = await this.sendStatements(chunk);
      results.push(result);
    }

    return results;
  }

  /**
   * Get a specific statement by ID
   */
  async getStatement(statementId: string): Promise<XAPIClientResponse> {
    try {
      const response = await this.makeRequest(`/statements?statementId=${statementId}`, 'GET');
      return {
        success: response.ok,
        statusCode: response.status,
        data: response.ok ? await response.json() : undefined,
        error: response.ok ? undefined : await response.text()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get statements with query parameters
   */
  async getStatements(params: {
    agent?: string;
    verb?: string;
    activity?: string;
    since?: string;
    until?: string;
    limit?: number;
    format?: 'ids' | 'exact' | 'canonical';
  }): Promise<XAPIClientResponse> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await this.makeRequest(`/statements?${queryParams.toString()}`, 'GET');
      return {
        success: response.ok,
        statusCode: response.status,
        data: response.ok ? await response.json() : undefined,
        error: response.ok ? undefined : await response.text()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test connection to LRS
   */
  async testConnection(): Promise<XAPIClientResponse> {
    try {
      const response = await this.makeRequest('/about', 'GET');
      return {
        success: response.ok,
        statusCode: response.status,
        data: response.ok ? await response.json() : undefined,
        error: response.ok ? undefined : await response.text()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async makeRequest(path: string, method: string, body?: unknown): Promise<Response> {
    const url = `${this.config.endpoint}${path}`;
    const headers: HeadersInit = {
      'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`,
      'X-Experience-API-Version': this.config.version!,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    };

    // Add timeout if supported
    if (this.config.timeout) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      options.signal = controller.signal;
      
      try {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    return fetch(url, options);
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimeout) {
      return;
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, 5000); // Flush after 5 seconds of inactivity
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// ============================================================================
// Offline Storage Support
// ============================================================================

export interface XAPIOfflineStorage {
  store(statements: XAPIStatement[]): Promise<void>;
  retrieve(): Promise<XAPIStatement[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export class LocalStorageXAPIStorage implements XAPIOfflineStorage {
  private key = 'xapi_offline_statements';

  async store(statements: XAPIStatement[]): Promise<void> {
    const existing = await this.retrieve();
    const combined = [...existing, ...statements];
    localStorage.setItem(this.key, JSON.stringify(combined));
  }

  async retrieve(): Promise<XAPIStatement[]> {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }

  async count(): Promise<number> {
    const statements = await this.retrieve();
    return statements.length;
  }
}

export class OfflineXAPIClient extends XAPIClient {
  private offlineStorage: XAPIOfflineStorage;
  private isOnline: boolean = navigator.onLine;

  constructor(config: XAPIClientConfig, storage?: XAPIOfflineStorage) {
    super(config);
    this.offlineStorage = storage || new LocalStorageXAPIStorage();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineStatements();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async sendStatement(statement: XAPIStatement): Promise<XAPIClientResponse> {
    if (!this.isOnline) {
      await this.offlineStorage.store([statement]);
      return {
        success: true,
        statusCode: 200,
        data: { message: 'Statement stored offline' },
        statementId: statement.id
      };
    }

    return super.sendStatement(statement);
  }

  async sendStatements(statements: XAPIStatement[]): Promise<XAPIClientResponse> {
    if (!this.isOnline) {
      await this.offlineStorage.store(statements);
      return {
        success: true,
        statusCode: 200,
        data: { message: 'Statements stored offline' }
      };
    }

    return super.sendStatements(statements);
  }

  async syncOfflineStatements(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    const offlineStatements = await this.offlineStorage.retrieve();
    if (offlineStatements.length === 0) {
      return;
    }

    try {
      const result = await super.sendStatements(offlineStatements);
      if (result.success) {
        await this.offlineStorage.clear();
      }
    } catch (error) {
      console.error('Failed to sync offline statements:', error);
    }
  }

  async getOfflineCount(): Promise<number> {
    return this.offlineStorage.count();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a standard xAPI client
 */
export function createXAPIClient(config: XAPIClientConfig): XAPIClient {
  return new XAPIClient(config);
}

/**
 * Create an offline-capable xAPI client
 */
export function createOfflineXAPIClient(config: XAPIClientConfig, storage?: XAPIOfflineStorage): OfflineXAPIClient {
  return new OfflineXAPIClient(config, storage);
}

/**
 * Create a mock xAPI client for testing
 */
export function createMockXAPIClient(): Partial<XAPIClient> {
  return {
    sendStatement: async (statement: XAPIStatement) => ({
      success: true,
      statusCode: 200,
      data: { id: statement.id },
      statementId: statement.id
    }),
    sendStatements: async (statements: XAPIStatement[]) => ({
      success: true,
      statusCode: 200,
      data: { count: statements.length }
    }),
    queueStatement: () => {},
    flushBatch: async () => [],
    getStatement: async () => ({ success: true, statusCode: 200, data: {} }),
    getStatements: async () => ({ success: true, statusCode: 200, data: [] }),
    testConnection: async () => ({ success: true, statusCode: 200, data: {} })
  };
}